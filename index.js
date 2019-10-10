
const GitStore = require("./lib/index.js");

const GIT_STORE = Symbol("GIT_STORE");

class GitStoreInterface {
	constructor(opts) {
		this[GIT_STORE] = new GitStore(opts);
	}

	create(opt) {
		return new GitStoreInterface(opt);
	}

	setOptions(args) {
		return this[GIT_STORE].setOptions(args);
	}

	async saveFile(args) {
		return await this[GIT_STORE].saveFile(args);
	}

	async deleteFile(args) {
		return await this[GIT_STORE].deleteFile(args);
	}

	async getFile(args) {
		return await this[GIT_STORE].getFile(args);
	}

	async getFileContent(args) {
		return await this[GIT_STORE].getFileContent(args);
	}

	async history(args) {
		return await this[GIT_STORE].history(args);
	}
}

module.exports = new GitStoreInterface();
