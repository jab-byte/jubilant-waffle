# 阿里云 MySQL 8.0 部署说明

## 1. 创建阿里云 MySQL 实例

1. 登录阿里云控制台，进入 RDS 管理控制台
2. 点击「创建实例」，选择 MySQL 8.0 版本
3. 选择合适的规格和存储空间
4. 设置 VPC 网络（推荐）或经典网络
5. 创建完成后，记录以下信息：
   - 内网/外网地址
   - 端口号（默认 3306）

## 2. 配置数据库

### 2.1 创建数据库账号

1. 在 RDS 实例详情页，点击「账号管理」
2. 创建一个高权限账号或普通账号
3. 记录用户名和密码

### 2.2 创建数据库

1. 在「数据库管理」中，点击「创建数据库」
2. 数据库名称：`zhaoSheng`
3. 字符集：`utf8mb4`
4. 授权账号：选择上一步创建的账号

### 2.3 执行建表脚本

使用 MySQL 客户端工具（如 Navicat、DBeaver 或命令行）连接数据库，执行以下脚本：

```sql
-- 文件位置: scripts/mysql_001_create_tables.sql

USE zhaoSheng;

-- 客户表
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(36) PRIMARY KEY,
  douyin VARCHAR(255) DEFAULT '',
  wechat VARCHAR(255) DEFAULT '',
  type VARCHAR(50) DEFAULT '未知',
  clientgender VARCHAR(20) DEFAULT '未知',
  studentname VARCHAR(100) DEFAULT '',
  studentgender VARCHAR(20) DEFAULT '未知',
  city VARCHAR(100) DEFAULT '',
  grade VARCHAR(50) DEFAULT '',
  score VARCHAR(50) DEFAULT '',
  phone VARCHAR(50) DEFAULT '',
  source VARCHAR(100) DEFAULT '',
  follower VARCHAR(100) DEFAULT '',
  school VARCHAR(255) DEFAULT '',
  status VARCHAR(50) DEFAULT '未沟通',
  logs JSON DEFAULT NULL,
  remark TEXT DEFAULT NULL,
  attachments JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at DESC),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 系统设置表
CREATE TABLE IF NOT EXISTS app_settings (
  `key` VARCHAR(100) PRIMARY KEY,
  `values` JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 插入默认设置
INSERT INTO app_settings (`key`, `values`) VALUES
  ('sources', '["地推", "转介绍", "抖音", "微信", "门店", "其他"]'),
  ('followers', '["老师A", "老师B", "老师C", "其他"]')
ON DUPLICATE KEY UPDATE `key` = `key`;
```

## 3. 配置白名单

如果从外部访问 RDS，需要配置 IP 白名单：

1. 在 RDS 实例详情页，点击「白名单设置」
2. 添加你的服务器 IP 或 Vercel 的 IP 范围
3. 对于 Vercel 部署，可能需要使用 `0.0.0.0/0`（允许所有 IP，不推荐用于生产环境）

## 4. 配置环境变量

### 本地开发

复制 `.env.mysql.example` 为 `.env.local`，填写实际的数据库连接信息：

```env
MYSQL_HOST=rm-xxx.mysql.rds.aliyuncs.com
MYSQL_PORT=3306
MYSQL_USER=your_username
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=zhaoSheng
```

### Vercel 部署

在 Vercel 项目设置中，添加以下环境变量：

| 变量名 | 值 | 示例 |
|--------|-----|------|
| MYSQL_HOST | MySQL 地址 | rm-xxx.mysql.rds.aliyuncs.com |
| MYSQL_PORT | 端口 | 3306 |
| MYSQL_USER | 用户名 | admin |
| MYSQL_PASSWORD | 密码 | your_password |
| MYSQL_DATABASE | 数据库名 | zhaoSheng |

## 5. 测试连接

启动本地开发服务器：

```bash
pnpm dev
```

访问 http://localhost:3000，使用 `admin / 123456` 登录测试。

## 6. 附件存储（可选）

当前版本已禁用附件上传功能。如需启用，请：

1. 创建阿里云 OSS Bucket
2. 创建 `/app/api/upload/route.ts` 上传接口
3. 修改 `page.tsx` 中的 `onAttachmentChange` 函数

## 常见问题

### Q: 连接超时

检查：
- 白名单是否正确配置
- 网络是否可达（telnet 测试）
- MySQL 实例是否正常运行

### Q: 认证失败

MySQL 8.0 默认使用 `caching_sha2_password` 认证插件。如果连接失败，可以执行：

```sql
ALTER USER 'your_user'@'%' IDENTIFIED WITH mysql_native_password BY 'your_password';
FLUSH PRIVILEGES;
```

### Q: 字符集问题

确保数据库和表使用 `utf8mb4` 字符集以支持中文和 emoji。
