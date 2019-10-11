
const fs = require("fs");
const _ =  require("lodash");
const assert = require("assert");
const base64 = require('js-base64').Base64;
const util = require("./util.js");

const git = require("../index.js");
const repopath = "test";
const ref = "master";


describe("git", async () => {

	it ("001 tree", async () => {
		util.rmdir("data/git/" + base64.encode(repopath));

		let id = await git.saveFile({
			repopath,
			filepath: "file.txt",
			content: "file.txt content",
			ref,
		});
		assert(id);

		id = await git.saveFile({
			repopath,
			filepath: "dir/file.txt",
			content: "dir/file.txt content",
			ref,
		});
		assert(id);

		id = await git.saveFile({
			repopath,
			filepath: "file2.txt",
			content: "file2.txt content",
			ref,
		});
		assert(id);

		id = await git.saveFile({
			repopath,
			filepath: "delete.txt",
			content: "delete.txt content",
			ref,
		});
		assert(id);

		// 移除文件
		let ok = await git.deleteFile({
			repopath, 
			filepath:"delete.txt", 
			ref,
		});
		assert(ok);

		const trees = await git.getTree({
			repopath, 
			ref,
			recursive: true,
		});
		assert(trees.length == 3);
	});
});
