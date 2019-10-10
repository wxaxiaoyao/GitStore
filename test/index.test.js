
const fs = require("fs");
const _ =  require("lodash");
const assert = require("assert");

const GitStore = require("../lib/index.js");

function rmdir(path){
    let files = [];
    if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach((file, index) => {
            let curPath = path + "/" + file;
            if(fs.statSync(curPath).isDirectory()){
                rmdir(curPath); //递归删除文件夹
            } else {
                fs.unlinkSync(curPath); //删除文件
            }
        });
        fs.rmdirSync(path);
    }
}

describe("git", () => {
	it("001 repository file", async () => {
		const git = new GitStore({});

		// 移除仓库
		//fs.rmdirSync("repository/test.git", {recursive: true});
		rmdir("data/git/test.git");

		let id = await git.saveFile({
			path: "test/file.txt",
			content: "hello world",
		});
		assert(id);

		id = await git.saveFile({
			path: "test/file1.txt",
			content: "hello world",
		});
		assert(id);

		id = await git.saveFile({
			path: "test/dir/file.txt",
			content: "hello world",
		});
		assert(id);

		id = await git.saveFile({
			path: "test/file.txt",
			content: "hello world 2",
		});
		assert(id);

		// 移除文件
		let ok = await git.deleteFile({path:"test/file.txt"});
		assert(ok);
	});

	it("002 history", async() => {
		const git = new GitStore({});
		const path = "test/file.txt";

		const list = await git.history({path: path});
		//console.log(list);
		assert(list.length == 3);

		let commitId = list[0].commitId;
		let text = await git.getFileContent({path, commitId}).catch(e => "");  // 不存在 已被删除
		//console.log("第一次提交内容: ", text);
		assert(text == "");

		commitId = list[1].commitId;
		text = await git.getFileContent({path, commitId})
		//console.log("第二次提交内容: ", text);
		assert(text, "hello world");

		commitId = list[2].commitId;
		text = await  git.getFileContent({path, commitId})
		//console.log("第三次提交内容: ", text);
		assert(text, "hello world 2");
	});
});

