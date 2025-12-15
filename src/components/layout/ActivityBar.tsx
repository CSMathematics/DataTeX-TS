import React from 'react'
import { Layout, Button, Tooltip } from 'antd'
import {
  FileOutlined,
  ExperimentOutlined,
  SettingOutlined,
  DatabaseOutlined
} from '@ant-design/icons'

const { Sider } = Layout

interface ActivityBarProps {
  activeActivity: string
  onActivityChange: (activity: string) => void
}

const ActivityBar: React.FC<ActivityBarProps> = ({ activeActivity, onActivityChange }) => {
  return (
    <Sider width={50} theme="dark" style={{ borderRight: `1px solid #303030`, background: '#333' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 10,
          gap: 20
        }}
      >
        <Tooltip title="File Explorer" placement="right">
          <Button
            type="text"
            icon={
              <FileOutlined
                style={{
                  fontSize: '24px',
                  color: activeActivity === 'explorer' ? '#fff' : '#858585'
                }}
              />
            }
            onClick={() => onActivityChange('explorer')}
          />
        </Tooltip>

        <Tooltip title="Database Manager" placement="right">
          <Button
            type="text"
            icon={
              <DatabaseOutlined
                style={{
                  fontSize: '24px',
                  color: activeActivity === 'database' ? '#fff' : '#858585'
                }}
              />
            }
            onClick={() => onActivityChange('database')}
          />
        </Tooltip>

        <Tooltip title="Wizards" placement="right">
          <Button
            type="text"
            icon={
              <ExperimentOutlined
                style={{
                  fontSize: '24px',
                  color: activeActivity === 'wizards' ? '#fff' : '#858585'
                }}
              />
            }
            onClick={() => onActivityChange('wizards')}
          />
        </Tooltip>

        <div style={{ flex: 1 }} />

        <Tooltip title="Settings" placement="right">
          <Button
            type="text"
            icon={<SettingOutlined style={{ fontSize: '24px', color: '#858585' }} />}
            style={{ marginBottom: 20 }}
            onClick={() => onActivityChange('settings')}
          />
        </Tooltip>
      </div>
    </Sider>
  )
}

export default ActivityBar
