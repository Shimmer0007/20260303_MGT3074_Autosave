# 🦃 MGT 3074 Worksheet Auto-Save

**Auto-save and restore your MGT 3074 Project Worksheet answers. Never lose your work again!** 
**自动保存并恢复你的 MGT 3074 项目 Worksheet 答案。再也不怕内容丢失！**

---

## 🌟 Features / 核心功能

* **Real-time Auto-Save** : Automatically saves your inputs in `textarea`, `input`, and `select` fields to the browser's local storage as you type.
  **实时自动保存** ：在你打字时，自动将 `textarea`、`input` 和 `select` 字段中的输入保存到浏览器的本地存储中。
* **Intelligent Week Detection** : Uses multiple strategies to identify the current worksheet week (e.g., Week 6, Week 7) to ensure data is stored in isolated partitions.
  **智能周次检测** ：使用多种策略识别当前的 Worksheet 周数（如 Week 6, Week 7），确保数据在隔离的分区中存储。
* **React State Compatibility** : Bypasses React's virtual DOM restrictions using native setters and event dispatching, ensuring the web app recognizes the restored content.
  **React 状态兼容** ：使用原生 Setter 和事件分发绕过 React 的虚拟 DOM 限制，确保网页应用能识别恢复的内容。
* **SPA Support** : Automatically detects page updates and restores content when switching between weeks in the Single Page Application (SPA).
  **SPA 支持** ：在单页面应用（SPA）中切换不同周次时，自动检测页面更新并恢复内容。
* **Data Management** : Features a Floating Action Button (FAB) and management panel to export data to JSON, delete specific weeks, or clear all records.
  **数据管理** ：提供悬浮按钮（FAB）和管理面板，支持将数据导出为 JSON、删除特定周次数据或清空所有记录。

---

## 🛠 Installation / 安装步骤

1. **Download** the extension folder to your computer.
   **下载** 扩展程序文件夹到你的电脑。
2. Open **Edge browser** and navigate to `edge://extensions/`.
   打开  **Edge 浏览器** ，访问 `edge://extensions/`。
3. Enable **Developer mode** in the bottom left corner.
   开启左下角的 **“开发人员模式”** 。
4. Click **Load unpacked** and select the extension folder.
   点击 **“解压后的扩展”** 并选择该扩展程序文件夹。
5. Visit [thehokiespirit.com/projectworksheets](https://thehokiespirit.com/projectworksheets) to start using.
   访问 [thehokiespirit.com/projectworksheets](https://thehokiespirit.com/projectworksheets) 即可开始使用。

---

## 🚀 How to Use / 如何使用

* **Saving** : Just start typing! The floating ball will change to ⏳ while saving and ✅ when finished.
* **保存** ：直接开始打字即可！悬浮球在保存时会变为 ⏳，保存完成后变为 ✅。
* **Restoring** : Content is automatically restored upon page load or when switching weeks. You will see a brief toast message in the bottom left.
* **恢复** ：页面加载或切换周次时内容会自动恢复。左下角会出现简短的提示消息。
* **Managing** : Click the 💾 floating ball to open the dashboard. From here, you can view saved weeks or export your data for backup.
* **管理** ：点击 💾 悬浮球打开仪表盘。在这里你可以查看已保存的周次，或导出数据进行备份。

---

## 🔒 Privacy & Security / 隐私与安全

* **Local Storage Only** : All data is stored exclusively on your device. Nothing is sent to any external server.
* **仅本地存储** ：所有数据仅存储在你的设备上，不会发送到任何外部服务器。
* **Scoped Access** : The extension only activates on the specific HokieHub worksheet domain.
* **范围访问** ：扩展程序仅在特定的 HokieHub Worksheet 域名下激活。

---

## 📄 License / 许可证

This project is licensed under the  **MIT License** .

本项目采用 **MIT 许可证** 开源。

 **Developed by Shimmer** .

 **由 Shimmer 开发** 。
