
const Store = require("./lib/store.js");

const STORE = Symbol("STORE");

class GitStoreInterface {
	constructor(opts) {
		this[STORE] = new Store(opts);
	}

	create(opt) {
		return new GitStoreInterface(opt);
	}

	setOptions(args) {
		return this[STORE].setOptions(args);
	}

	async openRepository(args) {
		return this[STORE].openRepository(args);
	}

	async upload(args) {
		return await this[STORE].upload(args);
	}

	async commit(args) {
		return await this[STORE].commit(args);
	}

	async saveFile(args) {
		return await this[STORE].saveFile(args);
	}

	async deleteFile(args) {
		return await this[STORE].deleteFile(args);
	}

	async getFile(args) {
		return await this[STORE].getFile(args);
	}

	async getFileContent(args) {
		return await this[STORE].getFileContent(args);
	}

	async history(args) {
		return await this[STORE].history(args);
	}

	async getTree(args) {
		return await this[STORE].getTree(args);
	}

	async getTreeById(args) {
		return await this[STORE].getTreeById(args);
	}

	async createArchive(args) {
		return await this[STORE].createArchive(args);
	}

	getRepoFullPath(args) {
		return this[STORE].getRepoFullPath(args);
	}

	formatRef(args) {
		return this[STORE].formatRef(args);
	}

    rename(args) {
        return this[STORE].rename(args);
    }
}

module.exports = new GitStoreInterface();
