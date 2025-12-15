import React, { useEffect, useState } from 'react'
import { Card, Statistic, Row, Col, Button, message } from 'antd'
import { ReloadOutlined, FileTextOutlined, FolderOpenOutlined } from '@ant-design/icons'

const DatabasePanel: React.FC = () => {
  const [stats, setStats] = useState<{ files: number; chapters: number }>({ files: 0, chapters: 0 })
  const [loading, setLoading] = useState(false)

  const fetchStats = async (): Promise<void> => {
    setLoading(true)
    try {
      if (window.api) {
        const data = await window.api.getDbStats()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch DB stats', error)
      message.error('Failed to load database statistics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  return (
    <div style={{ padding: 16, color: '#ccc' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          borderBottom: '1px solid #303030',
          paddingBottom: 8
        }}
      >
        <span style={{ fontWeight: 'bold', fontSize: 11 }}>DATABASE MANAGER</span>
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined spin={loading} />}
          onClick={fetchStats}
          style={{ color: '#ccc' }}
        />
      </div>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card size="small" style={{ background: '#2b2b2b', borderColor: '#444' }}>
            <Statistic
              title={<span style={{ color: '#aaa', fontSize: 12 }}>Total Files</span>}
              value={stats.files}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#fff', fontSize: 18 }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" style={{ background: '#2b2b2b', borderColor: '#444' }}>
            <Statistic
              title={<span style={{ color: '#aaa', fontSize: 12 }}>Chapters</span>}
              value={stats.chapters}
              prefix={<FolderOpenOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#fff', fontSize: 18 }}
            />
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 8, textTransform: 'uppercase' }}>
          Info
        </div>
        <div style={{ fontSize: 12, color: '#aaa' }}>
          Database Location: User Data / datatex_v2.db
        </div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
          Engine: SQLite3 (better-sqlite3)
        </div>
      </div>
    </div>
  )
}

export default DatabasePanel
