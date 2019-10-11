
const fs = require("fs");
const _ =  require("lodash");
const assert = require("assert");
const Git = require("nodegit");

describe("nodegit", async () => {

	it ("repository", async () => {
		// 支持递归创建
		Git.Repository.init("data/test/test/test", 1);
	});
});
