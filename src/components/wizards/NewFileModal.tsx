import React from 'react'
import { Modal, Form, Input, Select } from 'antd'
import { FileOutlined } from '@ant-design/icons'

const { Option } = Select

interface NewFileModalProps {
  open: boolean
  onCancel: () => void
  onCreate: (values: { title: string; chapter: string }) => void
  chapters: string[]
}

const NewFileModal: React.FC<NewFileModalProps> = ({ open, onCancel, onCreate, chapters }) => {
  const [form] = Form.useForm()

  const handleOk = (): void => {
    form
      .validateFields()
      .then((values) => {
        onCreate(values)
        form.resetFields()
      })
      .catch((info) => {
        console.log('Validate Failed:', info)
      })
  }

  return (
    <Modal title="Create New File" open={open} onOk={handleOk} onCancel={onCancel} okText="Create">
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="Filename"
          rules={[{ required: true, message: 'Please enter a filename' }]}
        >
          <Input placeholder="example.tex" prefix={<FileOutlined />} />
        </Form.Item>
        <Form.Item
          name="chapter"
          label="Chapter / Folder"
          rules={[{ required: true, message: 'Please select or create a chapter' }]}
        >
          <Select mode="tags" placeholder="Select existing or type new">
            {chapters.map((c) => (
              <Option key={c} value={c}>
                {c}
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default NewFileModal
