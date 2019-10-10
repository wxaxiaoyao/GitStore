## GitStore

GitStore 是基于 Git 实现的一种带有历史版本的文件存储服务, 更为准确的说是对象存储系统.  因为本服务对文件的层级维护没有太多优化, 完全是基于系统的文件系统存储. 因此更像对象存储服务, 对象即文件.  主要提供了文件的文件增, 删, 查, 改和历史提交的获取.  

### 实现原理

由于 Git 本身就是内容寻址文件系统, 是具备做为对象存储系统的优良条件. Git 的实现思路为 commit -> tree -> blob;

### 特性
- 支持文件基本的增,删,查,改
- 支持文件历史版本获取
- 支持水平扩展, 多进程

### 安装
```
npm install git-history-store --save
```

### 示例
```
const GitStore = require("git-store");

// 增改文件
const id = await GitStore.saveFile({
	path: "test/file",
	content: "object content",
});

console.log(id); // 输出文件的 sha

// 删除文件
const ok = await GitStore.deleteFile({path:"test/file"}); 

// 文件提交历史
const commits = await GitStore.history({path: "test/file"});
```

### 接口
#### GitStore.create(opts)
> 创建存储实例, GitStore 本身也是实例.

- opt.storePath 存储路径
- opt.timeout 超时时间 默认 10000 ms
- opt.author.name 所属者用户名 默认 git-store
- opt.author.email 所属者邮箱  默认 git-store@email.com 

**返回**
- GitStore 示例

#### GitStore.setOptions(opts) 
> 设置存储示例配置项, 同创建 opts, 无返回

#### GitStore.saveFile(args)
> 保存文件, 不存在创建, 存在覆盖.

**参数**
- args.path 文件路径
- args.content 文件内容
- args.message 提交备注
- args.ref 提交分支 默认为路径path对应的分支
- args.committer.name 提交者用户名
- args.committer.email 提交者邮箱

**返回**
- string commitId 提交Id

#### GitStore.deleteFile(args) 
> 删除文件

**参数**
- args.path 文件路径
- args.message 提交备注
- args.ref 提交分支 默认为路径path对应的分支
- args.committer.name 提交者用户名
- args.committer.email 提交者邮箱

**返回**
- boolean true 删除成功  false 删除失败

#### GitStore.getFile(args) 
> 获取文件

**参数**
- args.path 文件路径
- args.ref 提交分支 默认为路径path对应的分支
- args.commitId 提交id, 可选. 用于获取指定版本的文件, 为空则为最新版本

**返回**
- content 文件内容
- commitId 提交Id
- message 提交信息
- date 提交日期
- committer 提交者信息

#### GitStore.history(args) 
> 获取文件提交历史

**参数**
- args.path 文件路径
- args.ref 提交分支 默认为路径path对应的分支
- args.commitId 提交id, 可选. 用于获取指定版本的文件, 为空则为最新版本
- args.maxCount 获取历史数量

**返回**
- commitId 提交Id
- message 提交信息
- date 提交日期
- committer 提交者信息



