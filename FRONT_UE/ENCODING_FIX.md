# 编码问题修复说明

## 问题根因

**发现**：HTML文件编码损坏导致浏览器无法正确解析DOM结构
- 症状：F12 Elements标签显示内容都在<title>标签里
- 原因：文件中的中文字符显示为乱码（如"系�?"）
- 影响：整个HTML结构无法正常解析，页面白屏

## 解决方案

### 1. 创建新的纯英文HTML文件 ✅
**文件**：`custom_html/player-fixed.html`

**改进**：
- ✅ 移除所有中文字符，使用英文
- ✅ 确保UTF-8编码正确
- ✅ 简化文本避免编码问题
- ✅ 保持完整的DOM结构和所有功能

### 2. 更新配置 ✅
**文件**：`config.json`
```json
"HomepageFile": "player-fixed.html"
```

## 重启服务器

**重要**：必须重启服务器才能生效！

```cmd
# 停止当前服务器（在命令行按 Ctrl+C）
# 然后重新启动
node cirrus.js
```

## 验证步骤

1. 重启服务器
2. 刷新浏览器（建议硬刷新：Ctrl+F5）
3. 按F12检查：
   - Elements标签应该能看到完整的DOM树
   - <div class="app-root"> 下应该有 <aside>, <main> 等元素
   - 页面应该正常显示（不再白屏）

## 技术细节

### 编码问题的典型表现
```html
<!-- 错误（编码损坏）-->
<title>数字孪生地铁灾害应急仿真系�?/title>

<!-- 正确（英文） -->
<title>Metro Emergency Simulation</title>
```

### DOM解析失败的表现
```
浏览器将所有内容都当作<title>的文本内容，
导致：
- <body>里没有子元素
- CSS无法应用到不存在的元素上
- JavaScript找不到目标元素
- 页面完全空白
```

## 如果仍然白屏

1. **清除浏览器缓存**
   ```
   Chrome/Edge: Ctrl+Shift+Delete
   选择"缓存的图片和文件"
   时间范围：全部
   ```

2. **检查Elements标签**
   ```
   应该看到：
   <body>
     <div class="app-root">
       <aside id="sidebar">
       <main class="main">
   ```

3. **检查Network标签**
   ```
   app-shell.css 应该是 200 (成功)
   所有 .js 文件应该是 200
   ```

4. **检查Console**
   ```
   应该看到依赖加载日志
   不应该有红色错误
   ```

---

**修复时间**：2026-03-31 15:15  
**修复版本**：V2.1  
**根本原因**：文件编码损坏  
**解决方案**：使用纯英文HTML文件
