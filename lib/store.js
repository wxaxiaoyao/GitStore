
const _path = require("path");
const _fs = require("fs");
const _ = require("lodash");
const assert = require("assert");
const Git = require("nodegit");
const base64 = require('js-base64').Base64;
const AsyncQueue = require("@wxaxiaoyao/async-queue");

//const STORE_MODE_GIT = Symbol("STORE_MODE_GIT");
//const STORE_MODE_OBJECT = Symbol("STORE_MODE_OBJECT");

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

		// 创建存储目录
		if (!_fs.existsSync(this.storePath)) {
			_fs.mkdirSync(this.storePath);
		}

		// 创建GIT目录
		this.gitPath = _path.join(this.storePath, "git");
		if (!_fs.existsSync(this.gitPath)) {
			_fs.mkdirSync(this.gitPath);
		}

		// 创建LOCK目录
		this.lockPath = _path.join(this.storePath, "lock");
		if (!_fs.existsSync(this.lockPath)) {
			_fs.mkdirSync(this.lockPath);
		}

		// 异步队列
		this.asyncQueue.setFileLock(true, this.lockpath);
	}

	// 打开git仓库
	async openRepository({path}) {
		path = _path.join(this.gitPath, base64.encode(path));
		//if (path.indexOf(this.gitPath) !== 0) throw new Error(`无效路径: ${path}`);

		// gitPath 也转成 git 仓库
		if (path === this.gitPath || _fs.existsSync(path)) {
			try {
				return await Git.Repository.openBare(path);
			} catch(e) {
				//console.log(e);
			}
		}

		return await Git.Repository.init(path, 1);
	}
	
	// 格式化引用
	formatRef({ref, filepath}) {
		return ref ? `refs/heads/self/${ref}` : `refs/heads/sys/${base64.encode(filepath)}`;
		//return ref ? `refs/heads/self/${ref}` : (this.storeMode == STORE_MODE_GIT ? `refs/heads/sys/master` : `refs/heads/sys/${base64.encode(filepath)}`);
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
	
	// 保存文件
	async saveFile({repopath, filepath, content = "", message, ref, committer = {}}) {
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
		const buf = Buffer.from(content);
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
			return false;
		});

		// 提交失败删除文件
		if (!oid) {
			const sha = id.tostrS();
			const objpath = _path.join(repopath, "objects", sha.substring(0,2), sha.substring(2));
			_fs.unlinkSync(objpath);
			throw new Error(`提交失败, 文件: ${sha}`);
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
			content: blob.toString(),
			rawcontent: blob.rawcontent(),
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
}

//Store.STORE_MODE_GIT = STORE_MODE_GIT;
//Store.STORE_MODE_OBJECT = STORE_MODE_OBJECT;

module.exports = Store;
