-- MySQL 8.0 建表脚本
-- 在阿里云 MySQL 控制台或 MySQL 客户端中执行此脚本

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS zhaoSheng DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
