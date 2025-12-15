import React from 'react'
import { Form, Slider, Switch, Divider } from 'antd'
import { SettingOutlined } from '@ant-design/icons'
import { AppSettings } from '../../types'

interface SettingsPanelProps {
  settings: AppSettings
  onUpdate: (newSettings: Partial<AppSettings>) => void
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ settings, onUpdate }) => {
  return (
    <div style={{ padding: 16, color: '#ccc' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 16,
          borderBottom: '1px solid #303030',
          paddingBottom: 8
        }}
      >
        <SettingOutlined style={{ marginRight: 8 }} />
        <span style={{ fontWeight: 'bold', fontSize: 11 }}>SETTINGS</span>
      </div>

      <Form layout="vertical">
        <Form.Item label={<span style={{ color: '#aaa' }}>Font Size: {settings.fontSize}px</span>}>
          <Slider
            min={10}
            max={30}
            value={settings.fontSize}
            onChange={(val) => onUpdate({ fontSize: val })}
          />
        </Form.Item>

        <Form.Item
          label={<span style={{ color: '#aaa' }}>Minimap</span>}
          style={{ marginBottom: 12 }}
        >
          <Switch
            checked={settings.minimap}
            onChange={(checked) => onUpdate({ minimap: checked })}
            checkedChildren="ON"
            unCheckedChildren="OFF"
          />
        </Form.Item>

        <Form.Item
          label={<span style={{ color: '#aaa' }}>Word Wrap</span>}
          style={{ marginBottom: 12 }}
        >
          <Switch
            checked={settings.wordWrap}
            onChange={(checked) => onUpdate({ wordWrap: checked })}
            checkedChildren="ON"
            unCheckedChildren="OFF"
          />
        </Form.Item>

        <Form.Item
          label={<span style={{ color: '#aaa' }}>Line Numbers</span>}
          style={{ marginBottom: 12 }}
        >
          <Switch
            checked={settings.lineNumbers}
            onChange={(checked) => onUpdate({ lineNumbers: checked })}
            checkedChildren="ON"
            unCheckedChildren="OFF"
          />
        </Form.Item>
      </Form>

      <Divider style={{ borderColor: '#303030' }} />
      <div style={{ fontSize: 11, color: '#666', textAlign: 'center' }}>DataTex v2.0.0</div>
    </div>
  )
}

export default SettingsPanel
