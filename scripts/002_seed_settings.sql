-- 初始化默认的下拉选项
insert into public.app_settings (key, values) values
  ('student_types', array['初三','初二','初一','小学','高中']),
  ('follow_statuses', array['待跟进','跟进中','已签约','已流失','已完成']),
  ('sources', array['朋友推荐','网络广告','地推','咨询电话','其他'])
on conflict (key) do nothing;
