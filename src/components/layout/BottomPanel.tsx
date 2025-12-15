import React from 'react'
import { Tabs, theme } from 'antd'
import { CloseOutlined } from '@ant-design/icons'

interface BottomPanelProps {
  isVisible: boolean
  onClose: () => void
  logs: string
}

const BottomPanel: React.FC<BottomPanelProps> = ({ isVisible, onClose, logs }) => {
  const {
    token: { colorBgContainer, colorBorder }
  } = theme.useToken()

  if (!isVisible) return null

  const items = [
    {
      key: 'output',
      label: 'Output',
      children: (
        <div
          style={{
            height: '100%',
            overflow: 'auto',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            padding: '8px',
            fontSize: '12px',
            color: logs.includes('Error') || logs.includes('!') ? '#ff4d4f' : 'inherit'
          }}
        >
          {logs || 'No output.'}
        </div>
      )
    },
    {
      key: 'problems',
      label: 'Problems',
      children: <div style={{ padding: 8 }}>No problems detected.</div>
    }
  ]

  return (
    <div
      style={{
        height: 200,
        borderTop: `1px solid ${colorBorder}`,
        background: colorBgContainer,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingRight: 8,
          background: '#252526' // Slightly darker header
        }}
      >
        <Tabs
          items={items}
          size="small"
          tabBarStyle={{ margin: 0, borderBottom: 'none', color: '#ccc' }}
        />
        <CloseOutlined onClick={onClose} style={{ cursor: 'pointer', padding: 8, color: '#ccc' }} />
      </div>
    </div>
  )
}

export default BottomPanel
