
const fs = require("fs");
const _ =  require("lodash");
const assert = require("assert");
const Git = require("nodegit");

describe("nodegit", async () => {

	it ("repository", async () => {
		// 支持递归创建
		Git.Repository.init("data/test/test/test", 1);
	});

    it ("config", async() => {
		Git.Repository.init("data/git", 1);
        const config = await Git.Config.openOndisk("data/git/config");
    
        const core = await config.getPath("core.bare");
        console.log(core);

        config.setString("remote.origin.url", "git@github.com:wxaxiaoyao/GitStore.git");
        
    });
});
