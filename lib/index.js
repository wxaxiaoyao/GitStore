
const _path = require("path");
const _fs = require("fs");
const _ = require("lodash");
const Git = require("nodegit");
const Git = require("nodegit");
const base64 = require('js-base64').Base64;
const AsyncQueue = require("@wxaxiaoyao/async-queue");

class GitStore {
	// 构造函数
	constructor(opts = {}) {
		this.storePath = opts.storePath || "data";
		this.timeout = opts.timeout || 10000; // 等待解锁时间

		const author = opts.author || {name:"git-store", email:"git-store@email.com"};
		this.author = Git.Signature.now(author.name, author.email);

		this.asyncQueue = AsyncQueue.create({

		});

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
		this.lockPath = _.path.join(this.storePath, "lock");
		if (!_fs.existsSync(this.lockPath)) {
			_fs.mkdirSync(this.lockPath);
		}
	}
	
	// 上文件锁 进程同步
	lock(path, timeout) {
		const startTime = _.now();
		return new Promise((resolve, reject) => {
			const _lock = () => {
				try {
					_fs.mkdirSync(path);
					return resolve(true);
				} catch(e) {
					if (timeout && (_.now() - startTime) > timeout) return resolve(false);
					console.log(`仓库被锁定, 等待解锁: ${path}`);
					setTimeout(_lock, 100);
				} 
			}
			return _lock();
		});
	}
	
	// 解除文件锁
	unlock(path) {
		_fs.rmdirSync(path);
	}

	// 解析路径
	parsePath(path) {
		path = _.trim(path, " " + _path.sep);
		if (path.indexOf(_path.sep) < 0) return;
		
		const fullpath = _path.join(this.gitPath, path);

		const obj =  _path.parse(fullpath);
		obj.filename = obj.base || ""; // 文件名
		obj.dirname = obj.dir;         // 目录名
		obj.repopath = (obj.dir || "") + ".git";
		//obj.lockpath = _path.join(this.lockPath, base64.encode(fullpath)); // 锁目录
		obj.fullpath = fullpath; // 全路径
		obj.path = path;         // 路径

		return obj;
	}


	// 打开git仓库
	async openRepository({path}) {
		if (path.indexOf(this.gitPath) !== 0) throw new Error(`无效路径: ${path}`);

		if (_fs.existsSync(path)) {
			return await Git.Repository.openBare(path);
		} else {
			const dir = _path.dirname(path);
			if (dir.length > this.gitPath.length) {    // 不能小于存储路径
				await this.openRepository({path: dir});
			}
			return await Git.Repository.init(path, 1); // 初始化为裸库
		}
	}
	
	// 格式化引用
	formatRef({ref, filename}) {
		return ref ? `refs/heads/self/${ref}` : `refs/heads/sys/${base64.encode(filename)}`;
	}

	// 获取锁路径
	getLockPath({repopath, ref}) {
		//return _path.join(this.lockpath, base64.encode(_path.join(repopath, ref))); 
		return _path(repopath, ref);
	}

	// 保存文件
	async saveFile({path = "", content = "", message, ref, committer = {}}) {
		const pathobj = this.parsePath(path);
		if (!pathobj) return ;
		const {repopath, filename} = pathobj;

		// 参数预处理
		ref = this.formatRef({ref, filename});
		message = message || `save file ${filename}`;
		committer = Git.Signature.now(committer.name || "git-store", committer.email || "git-store@email.com");

		// 打开仓库
		const repo = await this.openRepository({path: repopath});
		if (!repo) return;

		const buf = Buffer.from(content);
		const id = await Git.Blob.createFromBuffer(repo, buf, buf.length);

		const lockpath = this.getLockPath({repopath, ref});
		// 针对仓库(repo)+引用(ref)同步操作
		const ok = await AsyncQueue.exec(lockpath, async () => {
			const parents = [];
			const headCommit = await this.getRefCommit({repo, ref});
			const treeUpdate = new Git.TreeUpdate();
			treeUpdate.action = Git.Tree.UPDATE.UPSERT;
			treeUpdate.filemode = Git.TreeEntry.FILEMODE.BLOB;
			treeUpdate.id = id;
			treeUpdate.path = filename;

			let treeId = null;
			if (headCommit) {
				parents.push(headCommit);
				const tree = await headCommit.getTree();
				treeId = await tree.createUpdated(repo, 1, [treeUpdate]);
			} else {
				const index = await repo.refreshIndex();
				const emptyTreeId = await index.writeTree();
				const tree = await repo.getTree(emptyTreeId);
				treeId = await tree.createUpdated(repo, 1, [treeUpdate]);
			}	
			const tree = await repo.getTree(treeId);
			const commit = await Git.Commit.create(repo, ref, this.author, _committer, null, message, tree, parents.length, parents);
			return true;
		}, {timeout: 10000}).catch(e => false);
		if (!ok) return ;

		return id;
		//const blob = await repo.getBlob(id);
		//console.log("---------------------save file finish-----------------------");
		//return commit;
		//return {
			//content: blob.toString(),
			//rawcontent: blob.rawcontent(),
			//size: blob.rawsize(),
			//binary: blob.isBinary(),
			//id: blob.id().tostrS(),
			//mode: blob.filemode(),
		//}
	}
}


module.exports = GitStore;
