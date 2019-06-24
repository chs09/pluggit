CREATE TABLE IF NOT EXISTS `datapoints` (
  `device` bigint(20) NOT NULL,
  `timestamp` bigint(20) NOT NULL,
  `t1` float NOT NULL COMMENT 'outside air',
  `t2` float NOT NULL COMMENT 'supply air',
  `t3` float NOT NULL COMMENT 'exhaust air',
  `t4` float NOT NULL COMMENT 'outgoing air',
  `t5` float NOT NULL COMMENT 'room',
  `fan1` float NOT NULL COMMENT 'fan1 rpm',
  `fan2` float NOT NULL COMMENT 'fan2 rpm',
  `humidity` smallint(6) NOT NULL,
  `bypass` enum('closed','in process','closing','opening','opened') NOT NULL,
  `speed` tinyint(4) NOT NULL,
  PRIMARY KEY (`device`, `timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `devices` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` text NOT NULL,
  `serial` int(11) NOT NULL,
  `version` text NOT NULL,
  `filter_reset` mediumint(9) NOT NULL,
  `work_time` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

CREATE TABLE IF NOT EXISTS `states` (
  `device` bigint(20) NOT NULL,
  `timestamp` bigint(20) NOT NULL,
  `state` enum('Standby','Manual','Demand','Week program','Servo-flow','Away','Summer','DI Override','Hygrostat override','Fireplace','Installer','Fail Safe 1','Fail Safe 2','Fail Off','Defrost Off','Defrost','Night') NOT NULL,
  `alarm` enum('None','Exhaust FAN Alarm','Supply FAN Alarm','Bypass Alarm','T1 Alarm','T2 Alarm','T3 Alarm','T4 Alarm','T5 Alarm','RH Alarm','Outdoor13 Alarm','Supply5 Alarm','Fire Alarm','Communication Alarm','FireTermostat Alarm','VOC Alarm') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;