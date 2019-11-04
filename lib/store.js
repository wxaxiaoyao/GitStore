
const _path = require("path");
//const _fs = require("fs");
const _fs = require("fs-extra");
const child_process = require("child_process");
const _ = require("lodash");
const assert = require("assert");
const Git = require("nodegit");
const base64 = require('js-base64').Base64;
//const AsyncQueue = require("../../asyncQueue/index.js");
const AsyncQueue = require("@wxaxiaoyao/async-queue");

//const STORE_MODE_GIT = Symbol("STORE_MODE_GIT");
//const STORE_MODE_OBJECT = Symbol("STORE_MODE_OBJECT");

const mkdir = (path) => {
	if (!path || path == ".." || path == "." || path == _path.sep || _fs.existsSync(path)) return false;
	
	try {
		_fs.mkdirSync(path);  // 创建目录
		return true;
	} catch(e) {
		if (e.code === "EEXIST") return false;
		if (e.code !== "ENOENT") return false;

		// 子目录不存在 创建子目录
		mkdir(_path.dirname(path));           
		
		// 重新创建目录, 使用系统接口避免死循环
		try {
			_fs.mkdirSync(path);                   
			return true;
		} catch(e) {
			return false;
		}
	}
}

class Store {
	constructor(opts) {
		this.author = Git.Signature.now("git-store", "git-store@email.comm");
		this.asyncQueue = AsyncQueue.create();

		this.setOptions(opts);
	}

	setOptions(opts = {}) {
		this.storePath = opts.storePath || this.storePath || "data";
		this.timeout = opts.timeout || this.timeout || 10000; // 等待解锁时间

		//this.storeMode = opts.storeMode || STORE_MODE_GIT; // GitStore  ObjectStore 

		if (opts.author) this.author = Git.Signature.now(opts.author.name, opts.author.email);

		// 转成绝对路径
		if (!_path.isAbsolute(this.storePath)) this.storePath = _path.join(process.cwd(), this.storePath);

		mkdir(this.storePath);

		//console.log("storePath:", this.storePath);

		// 创建存储目录
		if (!_fs.existsSync(this.storePath)) {
			_fs.mkdirSync(this.storePath);
		}

		// 创建GIT目录
		this.gitPath = opts.gitPath || _path.join(this.storePath, "git");
		if (!_path.isAbsolute(this.gitPath)) this.gitPath = _path.join(process.cwd(), this.gitPath);
		if (!_fs.existsSync(this.gitPath)) {
			_fs.mkdirSync(this.gitPath);
		}

		// 创建LOCK目录
		this.lockPath = opts.lockPath || _path.join(this.storePath, "lock");
		if (!_path.isAbsolute(this.lockPath)) this.lockPath = _path.join(process.cwd(), this.lockPath);
		if (!_fs.existsSync(this.lockPath)) {
			const ok = _fs.mkdirSync(this.lockPath);
		}

		// 异步队列
        this.asyncQueue.setFileLock(true, this.lockPath);
	}

	// 获取仓库全路径
	getRepoFullPath(repopath) {
		if (_path.isAbsolute(repopath)) return repopath;

		return _path.join(this.gitPath, base64.encode(repopath));
	}

	// 获取对象路径
	getObjectPath({repopath, sha}) {
		return _path.join(this.getRepoFullPath(repopath), "objects", sha.substring(0,2), sha.substring(2));
	}

	// 打开git仓库
	async openRepository({path}) {
		path = _path.join(this.gitPath, base64.encode(path));
		//if (path.indexOf(this.gitPath) !== 0) throw new Error(`无效路径: ${path}`);

		// gitPath 也转成 git 仓库
        const exists = await _fs.exists(path);
		if (path === this.gitPath || exists) {
			try {
				return await Git.Repository.openBare(path);
			} catch(e) {
				//console.log(e);
			}
		}

		// 新建仓库
		const repo = await Git.Repository.init(path, 1);
		const index = await repo.refreshIndex();
		const emptyTreeId = await index.writeTree();
		const tree = await repo.getTree(emptyTreeId);
		const message = `git repository init commit`;
		const committer = Git.Signature.now("git-store", "git-store@email.com");
		const commit = await Git.Commit.create(repo, "refs/heads/master", committer, committer, null, message, tree, 0, []);
		return repo;
	}
	
	// 格式化引用
	formatRef({ref, filepath}) {
		if (ref && ref.indexOf(_path.join("refs", "heads")) === 0) return ref;

		if (ref) {
			if (ref == "master") return _path.join("refs", "heads", "master");
			else return  _path.join("refs", "heads", "self", ref);
		} else {
			return _path.join("refs", "heads", "sys", base64.encode(filepath));
		}
	}

	// 获取ref提交  不存在丢出异常, 但程序可以继续执行 故做此包裹
	async getRefCommit({repo, ref}) {
		try {
			return await repo.getReferenceCommit(ref);
		} catch(e) {
			return null;
		}
	}

	// 获取锁路径
	getLockPath({repopath, ref}) {
		//return _path.join(this.lockpath, base64.encode(_path.join(repopath, ref))); 
		return _path.join(repopath, ref);
	}
	
	// 上传文件
	async upload({repopath, content, encoding}) {
		// 打开仓库
		const repo = await this.openRepository({path: repopath});
		if (!repo) throw new Error(`打开仓库失败: ${repopath}`);

		// 写文件对象
		const buf = Buffer.from(content, encoding);
		const id = await Git.Blob.createFromBuffer(repo, buf, buf.length);

		return id.tostrS();
	}

	// 提交文件
	async commit({repopath, files = [], message, ref = "master", committer = {}}) {
		// 打开仓库
		const repo = await this.openRepository({path: repopath});
		if (!repo) throw new Error(`打开仓库失败: ${repopath}`);

		ref = this.formatRef({ref});
		message = message || `commit files`;
		committer = Git.Signature.now(committer.name || "git-store", committer.email || "git-store@email.com");

		// 针对仓库(repo)+引用(ref)同步操作
		const lockpath = this.getLockPath({repopath, ref});
		const oid = await this.asyncQueue.exec(lockpath, async () => {
			const refCommit = await this.getRefCommit({repo, ref});
			const parents = refCommit ? [refCommit] : [];
			const treeUpdates = [];
			for (let i = 0; i < files.length; i++) {
				const file = files[i];
				const treeUpdate = new Git.TreeUpdate();
				treeUpdate.action = file.action == "upsert" ? Git.Tree.UPDATE.UPSERT : Git.Tree.UPDATE.REMOVE;
				treeUpdate.filemode = Git.TreeEntry.FILEMODE.BLOB;
				treeUpdate.id = Git.Oid.fromString(file.id);
				treeUpdate.path = file.path;
				treeUpdates.push(treeUpdate);
			}

			let tree = null;
			if (refCommit) {
				tree = await refCommit.getTree();
			} else {
				const index = await repo.refreshIndex();
				const emptyTreeId = await index.writeTree();
				tree = await repo.getTree(emptyTreeId);
			}	
		    tree = await repo.getTree(await tree.createUpdated(repo, treeUpdates.length, treeUpdates));
			return await Git.Commit.create(repo, ref, this.author, committer, null, message, tree, parents.length, parents);

		}, {timeout: 10000}).catch(e => {
			return ;
		});

		return oid && oid.tostrS();
	}

	// 保存文件
	async saveFile({repopath, filepath, content = "", message, ref, committer = {}, encoding}) {
		assert(repopath);
		assert(filepath);

		// 参数预处理
		ref = this.formatRef({ref, filepath});
		message = message || `save file ${filepath}`;
		committer = Git.Signature.now(committer.name || "git-store", committer.email || "git-store@email.com");

		// 打开仓库
		const repo = await this.openRepository({path: repopath});
		if (!repo) throw new Error(`打开仓库失败: ${repopath}`);

		// 写文件对象
		const buf = Buffer.from(content, encoding);
		const id = await Git.Blob.createFromBuffer(repo, buf, buf.length);

		// 针对仓库(repo)+引用(ref)同步操作
		const lockpath = this.getLockPath({repopath, ref});
		const oid = await this.asyncQueue.exec(lockpath, async () => {
			const parents = [];
			const refCommit = await this.getRefCommit({repo, ref});
			const treeUpdate = new Git.TreeUpdate();
			treeUpdate.action = Git.Tree.UPDATE.UPSERT;
			treeUpdate.filemode = Git.TreeEntry.FILEMODE.BLOB;
			treeUpdate.id = id;
			treeUpdate.path = filepath;

			let treeId = null;
			if (refCommit) {
				parents.push(refCommit);
				const tree = await refCommit.getTree();
				treeId = await tree.createUpdated(repo, 1, [treeUpdate]);
			} else {
				const index = await repo.refreshIndex();
				const emptyTreeId = await index.writeTree();
				const tree = await repo.getTree(emptyTreeId);
				treeId = await tree.createUpdated(repo, 1, [treeUpdate]);
			}	
			const tree = await repo.getTree(treeId);
			return await Git.Commit.create(repo, ref, this.author, committer, null, message, tree, parents.length, parents);
		}, {timeout: 10000}).catch(e => {
            console.log(e);
			return false;
		});

		// 提交失败删除文件
		if (!oid) {
			await _fs.unlink(this.getObjectPath({repopath, sha: id.tostrS()}));
			throw new Error(`提交失败, 文件: ${id}`);
		}

		return oid.tostrS();
	}
	
	// 删除文件
	async deleteFile({repopath, filepath, ref, message, committer = {}}) {
		assert(repopath);
		assert(filepath);

		// 参数预处理
		ref = this.formatRef({ref, filepath});
		message = message || `delete file ${filepath}`;
		committer = Git.Signature.now(committer.name || "git-store", committer.email || "git-store@email.com");

		// 打开仓库
		const repo = await this.openRepository({path: repopath});
		if (!repo) throw new Error(`打开仓库失败: ${repopath}`);

		// 针对仓库(repo)+引用(ref)同步操作
		const lockpath = this.getLockPath({repopath, ref});
		return await this.asyncQueue.exec(lockpath, async () => {
			const refCommit = await this.getRefCommit({repo, ref});
			if (refCommit == null) return false; 

			const parents = [refCommit];

			// 获取现有树
			const refTree = await refCommit.getTree();
			const entry = await refTree.entryByPath(filepath);
			if (!entry)	return false;

			// 更新项
			const treeUpdate = new Git.TreeUpdate();
			treeUpdate.action = Git.Tree.UPDATE.REMOVE;
			treeUpdate.filemode = Git.TreeEntry.FILEMODE.BLOB;
			treeUpdate.id = entry.id();
			treeUpdate.path = filepath;

			// 更新树
			const treeId = await refTree.createUpdated(repo, 1, [treeUpdate]);
			const tree = await repo.getTree(treeId);

			// 提交
			const commit = await Git.Commit.create(repo, ref, this.author, committer, null, message, tree, parents.length, parents);

			return true;
		});
	}
	
	// 获取文件
	async getFile({repopath, filepath, commitId, ref}) {
		assert(repopath);
		assert(filepath);
		
		// 格式化引用
		ref = this.formatRef({ref, filepath});

		// 打开仓库
		const repo = await this.openRepository({path: repopath});
		if (!repo) throw new Error(`打开仓库失败: ${repopath}`);

		// 获取commit
		const commit = commitId ? await repo.getCommit(commitId) : await this.getRefCommit({repo, ref});
		if (!commit) throw new Error(`资源不存在, 无提交记录`);

		// 获取tree entry
		const treeEntry = await commit.getEntry(filepath);  // 此函数会抛出异常

		// 获取对象 blob
		const blob = await treeEntry.getBlob();

		// 格式化成文件对象
		return blob ? {
			content: blob.content(),
			size: blob.rawsize(),
			binary: blob.isBinary(),
			id: blob.id().tostrS(),
			mode: blob.filemode(),
			message: commit.message(),
			date: commit.date(),
			commitId: commit.sha(),
			committer: {
				name: commit.author().name(),
				email: commit.author().email(),
			}, 
			objectpath: this.getObjectPath({repopath, sha: blob.id().tostrS()}),
		} : undefined;
	}

	// 获取文件内容
	async getFileContent({repopath, filepath, commitId, ref}) {
		const file = await this.getFile({repopath, filepath, commitId, ref});

		return (file || {}).content;
	}

	// 文件历史记录
	async history({repopath, filepath, commitId, maxCount = 100, ref}) {
		assert(repopath);
		assert(filepath);
		
		// 格式化引用
		ref = this.formatRef({ref, filepath});

		// 打开仓库
		const repo = await this.openRepository({path: repopath});
		if (!repo) throw new Error(`打开仓库失败: ${repopath}`);

		const commit = commitId ? await repo.getCommit(commitId) : await this.getRefCommit({repo, ref});
		if (commit == null) return [];

		const revwalk = repo.createRevWalk();

		revwalk.push(commit.sha());

		const list = await revwalk.fileHistoryWalk(filepath, maxCount);

		return list.map(entry => {
			const commit = entry.commit;
			return {
				committer: {
					name: commit.author().name(),
					email: commit.author().email(),
				}, 
				message: commit.message(),
				date: commit.date(),
				commitId: commit.sha(),
			}
		});
	}

	// 通过sha获取tree
	async getTreeById({repo, repopath, id, recursive,  prefix = ""}) {
        if (!repo && !repopath) return [];
		repo = repo || await this.openRepository({path: repopath});
		if (!repo) return [];;

		const getTree =  async (id, recursive, prefix) => {
			const tree = await repo.getTree(id);
			if (!tree) return [];

			const size = tree.entryCount();
			const children = [];
			for (let i = 0; i < size; i++) {
				const entry = tree.entryByIndex(i);
				const data = {
					name: entry.name(),
					path: _path.join(prefix, entry.path()),
					filemode: entry.filemode(),
					isTree: entry.isTree(),
					isBlob: entry.isBlob(),
					id: entry.id().tostrS(),
				};
				if (recursive && data.isTree) {
					data.children = await getTree(data.id, recursive, data.path);
				}
				children.push(data);
			}
			return children;
		}

		return  await getTree(id, recursive, prefix);
	}

	// 获取树
	async getTree({repopath, filepath = "", ref, recursive, prefix = ""}) {
		assert(repopath);
		// 格式化引用
		ref = this.formatRef({ref, filepath});
		
		// 打开仓库
		const repo = await this.openRepository({path: repopath});
		if (!repo) throw new Error(`打开仓库失败: ${repopath}`);

		const commit = await this.getRefCommit({repo, ref});
		if (commit == null) return [];

		let treeId = commit.treeId();
		if (filepath) {
			const entry = await commit.getEntry(filepath);
			if (!entry || !entry.isTree()) return [];
			treeId = entry.id();
		}

		return await this.getTreeById({repo, id: treeId, recursive, prefix});
	}

	// 创建归档文件  zip tar tar.gz
	async createArchive({repopath, ref = "ref/heads/master", format = "zip", archivePath}) {
		const fullpath = this.getRepoFullPath(repopath);
		archivePath = archivePath || _path.join(fullpath, `archive-${ref}.${format}`);

		return new Promise((resolve, reject) => {
			child_process.exec(`git archive --format=${format} -o ${archivePath} ${ref}`, {
				cwd: fullpath,
			}, (error, stdout, stderr) => {
				if (error) {
					reject(`执行错误: ${error}`);
					return ;
				}

				//console.log(`stdout: ${stdout}`);
				//console.log(`stderr: ${stderr}`);
				return resolve(archivePath);
			});
		});
	}

    // 改名
    async rename({oldRepoPath, newRepoPath}) {
        const oldFullPath = this.getRepoFullPath(oldRepoPath);
        const newFullPath = this.getRepoFullPath(newRepoPath);

        if (!_fs.existsSync(oldFullPath)) {
            throw(`仓库不存在: ${oldFullPath}`);
        }
        if (_fs.existsSync(newFullPath)) {
            throw(`仓库已存在: ${newFullPath}`);
        }

        await _fs.rename(oldFullPath, newFullPath);

        return ;
    }
}

//Store.STORE_MODE_GIT = STORE_MODE_GIT;
//Store.STORE_MODE_OBJECT = STORE_MODE_OBJECT;

module.exports = Store;
