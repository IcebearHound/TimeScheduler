# 大学生时间规划器 - 完整实现计划

## 进度统计
- 已完成：基础框架、类型系统、存储系统、TimeTable视图
- 待完成：完整功能实现

## 实现阶段（优先级排序）

### 阶段1：右键菜单和事件编辑（P0 - 核心）
- [x] 右键菜单结构设计
- [ ] 完整右键菜单实现（编辑、复制、剪切、删除）
- [ ] 拖动排序功能
- [ ] 快捷键系统（Ctrl+C、Ctrl+V、Ctrl+X、Delete）
- [ ] 编辑事件模态框完整功能

### 阶段2：事件链管理（P0 - 核心）
- [ ] 事件链创建和编辑
- [ ] 事件链颜色管理
- [ ] 重点事件标记
- [ ] 事件链默认提醒设置
- [ ] 单击事件时突显事件链

### 阶段3：课程表导入（P1 - 重要）
- [ ] XLS文件解析（使用xlsx库）
- [ ] 课程表格式识别和数据提取
- [ ] 周次解析（第1-16周、第6周、第8周等格式）
- [ ] 奇偶周处理（特殊周次处理）
- [ ] 自动事件链创建

### 阶段4：冲突检测和优先级（P1 - 重要）
- [ ] 冲突检测UI（ConflictDialog）
- [ ] 冲突时间段可视化
- [ ] 优先级拖动排序
- [ ] 冲突解决方案应用

### 阶段5：事件组和.events文件（P2 - 完整性）
- [ ] .events文件格式设计
- [ ] 事件组增删改查
- [ ] 事件组导出（.events文件）
- [ ] 事件组导入（.events文件）
- [ ] 事件组融合

### 阶段6：多级类型系统（P3 - 完整性）
- [ ] 多级类型标签（如：课程-理论课、课程-实验课-实验验收）
- [ ] 类型管理UI
- [ ] 复杂规则修改（每周/奇数/偶数周的周几的第几个事件）

### 阶段7：高级筛选（P3 - 增强）
- [ ] 按事件类型筛选
- [ ] 按事件链筛选
- [ ] 按优先级筛选
- [ ] 筛选状态持久化

### 阶段8：提醒系统（P2 - 重要）
- [ ] 本地通知API集成
- [ ] 提醒时间折叠列表UI
- [ ] 提醒触发和通知显示
- [ ] 提醒状态管理

## 关键功能列表

### 一、TimeTable和事件
- [x] 日/周/月视图
- [x] 事件块显示
- [ ] 拖动排序
- [ ] 右键菜单（编辑/复制/剪切/删除）
- [ ] 快捷键支持
- [ ] 事件链管理
- [ ] 重点事件标记

### 二、冲突检测
- [ ] 时间重叠检测
- [ ] ConflictDialog UI
- [ ] 优先级调整
- [ ] 冲突可视化

### 三、课程表导入
- [ ] SDU 课表XLS解析
- [ ] 学期配置
- [ ] 自动课程事件链创建
- [ ] 导入成功提示

### 四、事件组
- [ ] .events文件格式
- [ ] 事件组管理
- [ ] 导出/导入功能
- [ ] 事件组融合

### 五、提醒系统
- [ ] 提醒时间设置
- [ ] 通知API
- [ ] 提醒UI

## 技术栈补充
- react-beautiful-dnd：拖放功能
- xlsx：Excel解析
- date-fns：日期处理
- lucide-react：图标
- Browser Notification API：系统通知

## 文件创建计划
1. `components/EventContextMenu.tsx` - 右键菜单组件
2. `components/EventEditModal.tsx` - 编辑事件模态框
3. `components/ConflictResolutionDialog.tsx` - 冲突处理对话框
4. `components/EventChainManager.tsx` - 事件链管理UI
5. `components/TypeSystemManager.tsx` - 类型系统管理
6. `hooks/useKeyboardShortcuts.ts` - 快捷键系统
7. `hooks/useDragAndDrop.ts` - 拖放系统
8. `utils/courseTableParser.ts` - 课程表解析
9. `utils/eventGroupExporter.ts` - 事件组导出
10. `utils/eventGroupImporter.ts` - 事件组导入

