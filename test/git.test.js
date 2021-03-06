
const fs = require("fs");
const _ =  require("lodash");
const assert = require("assert");
const base64 = require('js-base64').Base64;
const util = require("./util.js");

const Git = require("../index.js");
const git = new Git();
const repopath = "test";
const ref = "master";


describe("git", async () => {

	it ("001 tree", async () => {
		util.rmdir("data/git");

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
			filepath: "中文.txt",
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

		// 创建归档文件
		await git.createArchive({repopath, ref});
	});
	
	it("002 push", async () => {
		util.rmdir("data/git");
		let id = await git.saveFile({
			repopath:"repo1",
			filepath: "file1",
			content: "file1 content",
            committer: {
                name:"test",
                email:"test@qq.com"
            }
		});
		//console.log(id);
		assert(id);

		id = await git.saveFile({
			repopath: "repo1",
			filepath: "file2",
			content: "repo1 file2 content",
		});
		//console.log(id);
		assert(id);
		
		id = await git.saveFile({
			repopath: "repo2",
			filepath: "file2",
			content: "file2 content",
		});
		//console.log(id);
		assert(id);
	});

	it("003 upload", async () => {
		util.rmdir("data/git");
		let id = await git.upload({
			repopath,
			filepath: "file1",
			content: "file1 content",
			base64: null,
		});
		//console.log(id);

		id = await git.commit({files:[{action:"upsert", filename:"file1", id}], repopath});
        assert(id);
		//console.log(id);
	});

    it("004 rename", async () => {
		util.rmdir("data/git");

		await git.saveFile({
			repopath: "repo1",
			filepath: "file2",
			content: "file2 content",
		});
        
        git.rename({oldRepoPath:"repo1", newRepoPath: "repo2"}); 
    });

});
