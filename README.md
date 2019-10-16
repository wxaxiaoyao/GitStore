## GitStore

GitStore 是基于 Git 实现的一种带有历史版本的文件存储服务. 技术交流群(733135641)

### 特性
- 支持文件基本的增,删,查,改. 仓库自动创建.
- 支持文件历史版本获取
- 支持水平扩展, 多进程

### 安装
```
npm install git-history-store --save
```

### 示例
```
const GitStore = require("git-history-store");

// 增改文件
const id = await GitStore.saveFile({
	repopath: "test",
	filepath: "test/file",
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
创建存储实例, GitStore 本身也是实例.

- opt.storePath 存储路径
- opt.timeout 超时时间 默认 10000 ms
- opt.author.name 所属者用户名 默认 git-store
- opt.author.email 所属者邮箱  默认 git-store@email.com 

**返回**
- GitStore 示例

#### GitStore.setOptions(opts) 
设置存储示例配置项, 同创建 opts, 无返回

#### GitStore.saveFile(args)
保存文件, 不存在创建, 存在覆盖.

**参数**
- args.repopath 仓库路径
- args.filepath 文件路径
- args.content 文件内容
- args.encoding 文件内容编码方式 默认 hex
- args.message 提交备注
- args.ref 提交分支 默认为路径path对应的分支
- args.committer.name 提交者用户名
- args.committer.email 提交者邮箱

**返回**
- string commitId 提交Id

#### GitStore.deleteFile(args) 
删除文件

**参数**
- args.repopath 仓库路径
- args.filepath 文件路径
- args.message 提交备注
- args.ref 提交分支 默认为路径path对应的分支
- args.committer.name 提交者用户名
- args.committer.email 提交者邮箱

**返回**
- boolean true 删除成功  false 删除失败

#### GitStore.getFile(args) 
获取文件

**参数**
- args.repopath 仓库路径
- args.filepath 文件路径
- args.ref 提交分支 默认为路径path对应的分支
- args.commitId 提交id, 可选. 用于获取指定版本的文件, 为空则为最新版本

**返回**
- content 文件内容
- commitId 提交Id
- message 提交信息
- date 提交日期
- committer 提交者信息

#### GitStore.history(args) 
获取文件提交历史

**参数**
- args.repopath 仓库路径
- args.filepath 文件路径
- args.ref 提交分支 默认为路径path对应的分支
- args.commitId 提交id, 可选. 用于获取指定版本的文件, 为空则为最新版本
- args.maxCount 获取历史数量

**返回**
- commitId 提交Id
- message 提交信息
- date 提交日期
- committer 提交者信息

#### GitStore.getTree(args) 
通过获取文件树

**参数**
- args.repopath 仓库路径
- args.filepath 文件路径
- args.recursive 是否递归
- args.ref 提交分支 默认为路径path对应的分支

**返回**
- id 标识ID
- name 文件名
- path 文件路径
- isTree 是否Tree
- children 当为Tree时, 此字段返回Tree的条目  recursive = true 时生效

#### GitStore.getTreeById(args) 
通过ID获取文件树

**参数**
- args.repopath 仓库路径
- args.id Tree ID
- args.recursive 是否递归

**返回**
- id 标识ID
- name 文件名
- path 文件路径
- isTree 是否Tree
- children 当为Tree时, 此字段返回Tree的条目  recursive = true 时生效




