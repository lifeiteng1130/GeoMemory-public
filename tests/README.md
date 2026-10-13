# 地图性能回归验证

运行逻辑回归测试（仅使用模拟地图、文件系统和数据库，不访问真实记录或地图接口）：

```sh
node --test tests/map-performance.test.cjs
```

限制子进程的环境可使用支持该参数的 Node.js 执行：

```sh
node --test --test-isolation=none tests/map-performance.test.cjs
```

测试覆盖标记复用、新增/移动/删除/换图、清空全部记录、旧缩略图请求丢弃、地图页面重载、生成的 HTML 消息处理、缩略图缓存和数据库批量查询。模拟测试不能替代高德地图和手机图片解码的真机验证。

本次新增 `expo-image-manipulator` 原生依赖。独立安装包需要重新构建；仅向旧安装包更新 JavaScript 不足以加载新原生模块。现有 GitHub Android 构建流程会执行 Expo prebuild，纳入该依赖。

## 真机检查

- 使用同一设备和同一批记录，对比优化前后的冷启动、拖动、缩放与详情返回。
- 检查横图、竖图、透明 PNG 和带旋转信息的照片，地图圆图应保持居中裁剪，详情继续显示原图。
- 新增一条带图记录，确认旧标记不闪烁，新增标记可点击。
- 删除记录并返回；删除最后一条后地图应不再有残留标记。
- 从详情快速反复返回首页，确认没有照片串位或旧任务覆盖新标记。
- 检查标准、暗色、卫星图层以及地图位置、缩放级别保持情况。
- 首次使用会逐张生成缓存；再次打开应复用缓存。缓存位于应用 cache 目录，系统清理后会重新生成，原始照片和导出内容不受影响。

生产 JS 包检查：

```sh
npx expo export --platform android --output-dir dist/performance-check
```

该命令验证 Metro/Hermes 打包，不生成 APK，也不证明真机帧率提升。
