import React from 'react'
import { Layout } from 'antd'
import { CodeOutlined } from '@ant-design/icons'

const { Footer } = Layout

interface StatusBarProps {
  text: string
}

const StatusBar: React.FC<StatusBarProps> = ({ text }) => {
  return (
    <Footer
      style={{
        height: 25,
        background: '#007acc',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        fontSize: 11,
        padding: '0 10px',
        lineHeight: '25px'
      }}
    >
      <div style={{ marginRight: 20 }}>
        <CodeOutlined /> Latex Mode
      </div>
      <div style={{ flex: 1 }}>{text}</div>
      <div style={{ marginRight: 20 }}>UTF-8</div>
    </Footer>
  )
}

export default StatusBar
