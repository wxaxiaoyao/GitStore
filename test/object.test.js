
const fs = require("fs");
const _ =  require("lodash");
const assert = require("assert");
const base64 = require('js-base64').Base64;
const util = require("./util.js");

const GitStore = require("../lib/store.js");

describe("object", () => {
	it("001 file", async () => {
		const git = new GitStore({});

		// 移除仓库
		//fs.rmdirSync("repository/test.git", {recursive: true});
		const repopath = "test.git";
		util.rmdir("data/git/" + base64.encode(repopath));

		let id = await git.saveFile({
			repopath,
			filepath: "test/file.txt",
			content: "hello world",
		});
		assert(id);

		id = await git.saveFile({
			repopath,
			filepath: "test/file1.txt",
			content: "hello world",
		});
		assert(id);

		id = await git.saveFile({
			repopath,
			filepath: "test/dir/file.txt",
			content: "hello world",
		});
		assert(id);

		id = await git.saveFile({
			repopath,
			filepath: "test/file.txt",
			content: "hello world 2",
		});
		assert(id);

		// 移除文件
		let ok = await git.deleteFile({repopath, filepath:"test/file.txt"});
		assert(ok);
	});

	it("002 history", async() => {
		const git = new GitStore({});
		const repopath = "test.git";
		const filepath = "test/file.txt";

		const list = await git.history({repopath, filepath});
		assert(list.length == 3);

		let commitId = list[0].commitId;
		let text = await git.getFileContent({repopath, filepath, commitId}).catch(e => "");  // 不存在 已被删除
		//console.log("第一次提交内容: ", text);
		assert(text == "");

		commitId = list[1].commitId;
		text = await git.getFileContent({repopath, filepath, commitId})
		//console.log("第二次提交内容: ", text);
		assert(text, "hello world");

		commitId = list[2].commitId;
		text = await  git.getFileContent({repopath, filepath, commitId})
		//console.log("第三次提交内容: ", text);
		assert(text, "hello world 2");
	});
});

