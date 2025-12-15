import React, { useState, useEffect, useMemo } from 'react'
import {
  Form,
  Input,
  Select,
  InputNumber,
  Checkbox,
  Switch,
  Button,
  Card,
  Tabs,
  Row,
  Col,
  Typography,
  Divider,
  Radio,
  Tag // Προσθήκη Tag για εμφάνιση χρωμάτων
} from 'antd'
import {
  FileTextOutlined,
  FormatPainterOutlined,
  AppstoreAddOutlined,
  GlobalOutlined,
  CheckOutlined,
  CodeOutlined,
  LayoutOutlined,
  CloseOutlined,
  BgColorsOutlined // Εικονίδιο για Color Picker
} from '@ant-design/icons'

const { Title, Paragraph } = Typography
const { TabPane } = Tabs
const { Option } = Select
const { TextArea } = Input

interface PreambleWizardViewProps {
  onInsert: (code: string) => void
}

// Δομή για τα προσαρμοσμένα χρώματα. Χρησιμοποιούμε μόνο HTML (HEX) για απλοποίηση
interface CustomColor {
  id: number
  name: string
  model: 'HTML' // Ορίζουμε το μοντέλο ως HTML
  values: string // Τιμή HEX, π.χ., FF0000
  hexCode: string // Τιμή HEX με #, π.χ., #FF0000
}

const PreambleWizardView: React.FC<PreambleWizardViewProps> = ({ onInsert }) => {
  const [form] = Form.useForm()

  // --- STATE ---
  const [generatedCode, setGeneratedCode] = useState('')
  const [previewTab, setPreviewTab] = useState('code')
  
  // Προσθήκη state για τα προσαρμοσμένα χρώματα
  const [customColors, setCustomColors] = useState<CustomColor[]>([])
  
  // Το newColor τώρα αποθηκεύει και την τιμή HEX με # για το input type=color
  const [newColor, setNewColor] = useState({ 
    name: '', 
    model: 'HTML' as const, 
    values: 'FF0000', // HEX χωρίς #
    hexCode: '#FF0000' // HEX με # για το color input
  })

  // Λίστα Γλωσσών για το Dropdown
  const languageOptions = [
    { value: 'english', label: 'English' },
    { value: 'greek', label: 'Greek (Ελληνικά)' },
    { value: 'german', label: 'German' },
    { value: 'french', label: 'French' },
    { value: 'spanish', label: 'Spanish' },
    { value: 'italian', label: 'Italian' },
    { value: 'portuguese', label: 'Portuguese' },
    { value: 'russian', label: 'Russian' },
    { value: 'chinese', label: 'Chinese' },
    { value: 'japanese', label: 'Japanese' },
    { value: 'korean', label: 'Korean' },
    { value: 'arabic', label: 'Arabic' },
    { value: 'hebrew', label: 'Hebrew' },
    { value: 'turkish', label: 'Turkish' },
    { value: 'swedish', label: 'Swedish' },
    { value: 'dutch', label: 'Dutch' },
    { value: 'polish', label: 'Polish' },
    { value: 'czech', label: 'Czech' },
    { value: 'slovak', label: 'Slovak' },
    { value: 'hungarian', label: 'Hungarian' },
    { value: 'finnish', label: 'Finnish' },
    { value: 'danish', label: 'Danish' },
    { value: 'norwegian', label: 'Norwegian' },
    { value: 'indonesian', label: 'Indonesian' },
    // Προσθέστε κι άλλες γλώσσες εδώ
  ];


  // Default Values
  const [values, setValues] = useState({
    docClass: 'article',
    fontSize: 11,
    paperSize: 'a4paper',
    encoding: 'utf8',
    mainLang: 'english', 
    title: '',
    author: '',
    date: true,
    
    // Geometry - Basic
    pkgGeometry: true,
    marginTop: 2.5,
    marginBottom: 2.5,
    marginLeft: 2.5,
    marginRight: 2.5,

    // Geometry - Advanced (Based on Image)
    columns: 'one', // 'one' | 'two'
    columnSep: 0.5,
    sidedness: 'oneside', // 'oneside' | 'twoside' | 'asymmetric'
    
    // Geometry - Margin Notes
    marginNotes: false,
    marginSep: 0.5,
    marginWidth: 3.0,
    includeMp: false, // include marginpar in body

    // Geometry - Header/Footer/Offset
    headHeight: 1.0, // Default to 1.0cm for visualization purposes
    headSep: 0.8,    // Default to 0.8cm for visualization purposes
    footSkip: 1.0,   // Default to 1.0cm for visualization purposes
    bindingOffset: 0,
    hOffset: 0,
    vOffset: 0,
    includeHead: false,
    includeFoot: false,

    // Packages
    pkgAmsmath: true,
    pkgGraphicx: true,
    pkgHyperref: true,
    pkgTikz: false,
    pkgPgfplots: false,
    pkgXcolor: true, // Ενεργοποίηση Xcolor ως default για τα χρώματα
    pkgBooktabs: false,
    pkgFloat: false,
    pkgFancyhdr: false
  })

  // --- LOGIC ---

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleValuesChange = (_: any, allValues: any) => {
    setValues((prev) => ({ ...prev, ...allValues }))
  }

  // Συνάρτηση για προσθήκη χρώματος
  const handleAddColor = () => {
    if (newColor.name && newColor.values) {
        // Καθαρισμός του ονόματος (μόνο αλφαριθμητικοί χαρακτήρες)
        const name = newColor.name.trim().replace(/[^a-zA-Z0-9]/g, '');
        
        setCustomColors(prev => [
            ...prev,
            { 
                id: Date.now(), 
                name: name,
                model: 'HTML', // Πάντα HTML (HEX)
                values: newColor.values.trim().toUpperCase(), // Τιμή χωρίς #
                hexCode: newColor.hexCode
            }
        ])
        // Επαναφορά φόρμας στο default κόκκινο
        setNewColor({ name: '', model: 'HTML', values: 'FF0000', hexCode: '#FF0000' }) 
    }
  }

  useEffect(() => {
    const code = buildCode()
    setGeneratedCode(code)
  // Προσθήκη customColors στα dependencies
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, customColors])

  const buildCode = () => {
    const v = values

    // Document Class Options - Explicitly typed as string[]
    let classOptions: string[] = []
    classOptions.push(`${v.fontSize}pt`)
    classOptions.push(v.paperSize)
    if (v.columns === 'two') classOptions.push('twocolumn')
    if (v.sidedness === 'twoside') classOptions.push('twoside')
    
    let c = `\\documentclass[${classOptions.join(', ')}]{${v.docClass}}\n`
    
    // Encoding & Font
    c += `\\usepackage[${v.encoding}]{inputenc}\n`
    c += `\\usepackage[T1]{fontenc}\n`
    
    // Babel Language Handling
    let babelOptions = ['english']; // Πάντα περιλαμβάνεται το English ως fallback
    if (v.mainLang !== 'english') {
      babelOptions.push(v.mainLang);
    }
    
    c += `\\usepackage[${babelOptions.join(',')}]{babel}\n`

    if (v.mainLang === 'greek') {
      c += `\\usepackage{alphabeta}\n`
    }
    
    // Geometry Package Generation
    if (v.pkgGeometry) {
      // Explicitly typed as string[] to fix the TS error
      let gOpts: string[] = []
      
      // Margins
      gOpts.push(`top=${v.marginTop}cm`)
      gOpts.push(`bottom=${v.marginBottom}cm`)
      gOpts.push(`left=${v.marginLeft}cm`)
      gOpts.push(`right=${v.marginRight}cm`)
      
      // Column Sep (if two columns)
      if (v.columns === 'two') gOpts.push(`columnsep=${v.columnSep}cm`)
      
      // Margin Notes
      if (v.marginNotes) {
        gOpts.push(`marginparsep=${v.marginSep}cm`)
        gOpts.push(`marginparwidth=${v.marginWidth}cm`)
        if (v.includeMp) gOpts.push(`includemp`)
      }
      
      // Header / Footer / Binding
      if (v.headHeight > 0) gOpts.push(`headheight=${v.headHeight}cm`)
      if (v.headSep > 0) gOpts.push(`headsep=${v.headSep}cm`)
      if (v.footSkip > 0) gOpts.push(`footskip=${v.footSkip}cm`)
      if (v.bindingOffset > 0) gOpts.push(`bindingoffset=${v.bindingOffset}cm`)
      
      // Offsets
      if (v.hOffset !== 0) gOpts.push(`hoffset=${v.hOffset}cm`)
      if (v.vOffset !== 0) gOpts.push(`voffset=${v.vOffset}cm`)
      
      // Includes
      if (v.includeHead) gOpts.push(`includehead`)
      if (v.includeFoot) gOpts.push(`includefoot`)
      if (v.sidedness === 'asymmetric') gOpts.push(`asymmetric`)

      c += `\\usepackage[${gOpts.join(', ')}]{geometry}\n`
    }

    // Common Packages
    c += `\n% --- PACKAGES ---\n`
    if (v.pkgAmsmath) c += `\\usepackage{amsmath, amsfonts, amssymb}\n`
    if (v.pkgGraphicx) c += `\\usepackage{graphicx}\n`
    
    // XColor και Custom Colors
    if (v.pkgXcolor) {
      // Προσθήκη της επιλογής HTML στο xcolor
      c += `\\usepackage[dvipsnames, x11names, table]{xcolor}\n`
    }
    
    // --- Custom XColor Definitions ---
    if (v.pkgXcolor && customColors.length > 0) {
        c += `\n% --- Custom XColor Definitions ---\n`
        customColors.forEach(color => {
            if (color.name && color.model === 'HTML' && color.values.length === 6) {
                const name = color.name.trim().replace(/[^a-zA-Z0-9]/g, ''); 
                const vals = color.values.trim().toUpperCase(); // Χωρίς #
                
                // Χρησιμοποιούμε το HTML μοντέλο του xcolor
                const defineColorCmd = `\\definecolor{${name}}{HTML}{${vals}}`
                
                c += `${defineColorCmd}\n`
            }
        })
    }
    // Τέλος διόρθωσης XColor

    // Υπόλοιπα Πακέτα
    if (v.pkgBooktabs) c += `\\usepackage{booktabs}\n`
    if (v.pkgFloat) c += `\\usepackage{float}\n`
    if (v.pkgTikz) c += `\\usepackage{tikz}\n`
    if (v.pkgPgfplots) {
      c += `\\usepackage{pgfplots}\n`
      c += `\\pgfplotsset{compat=1.18}\n`
    }
    if (v.pkgFancyhdr) {
      c += `\\usepackage{fancyhdr}\n`
      c += `\\pagestyle{fancy}\n`
    }


    // Hyperref (Πρέπει να είναι τελευταίο πακέτο)
    if (v.pkgHyperref) {
      c += `\\usepackage{hyperref}\n`
      c += `\\hypersetup{colorlinks=true, linkcolor=blue, filecolor=magenta, urlcolor=cyan}\n`
    }


    // Metadata
    c += `\n% --- METADATA ---\n`
    c += `\\title{${v.title || 'Untitled Document'}}\n`
    c += `\\author{${v.author || 'Author Name'}}\n`
    if (v.date) c += `\\date{\\today}\n`
    else c += `\\date{}\n`

    // Body
    c += `\n% --- DOCUMENT ---\n`
    c += `\\begin{document}\n\n`
    c += `\\maketitle\n\n`
    c += `% Content goes here\n`
    c += `\\section{Introduction}\n`
    
    if (v.columns === 'two') {
       c += `This is a two-column document. Use \\\\onecolumn to switch back temporarily.\n`
    }
    
    // Προσθήκη παραδείγματος χρήσης των custom χρωμάτων
    if (customColors.length > 0) {
        c += `\n% Example usage of custom colors:\n`
        customColors.slice(0, 3).forEach(color => {
            c += `\\color{${color.name}} This text is rendered in color \\texttt{${color.name}} (${color.hexCode}). \\\\\n`
        })
        c += `\\color{black} This text is back to black.\n`
    }
    
    c += `\n\\end{document}`
    return c
  }

  // --- VISUALIZATION CONSTANTS ---
  const PAGE_WIDTH_PX = 300
  const A4_ASPECT_RATIO = 1.414 // A4 height/width
  const PAGE_HEIGHT_PX = PAGE_WIDTH_PX * A4_ASPECT_RATIO
  const A4_WIDTH_CM = 21 // A4 width in cm
  const CM_TO_PX = PAGE_WIDTH_PX / A4_WIDTH_CM 

  // Use useMemo to avoid recalculating style properties unnecessarily
  const geometryStyles = useMemo(() => {
    // Calculate Header/Footer/Body offsets
    const headerHeightPx = values.pkgGeometry ? values.headHeight * CM_TO_PX : 0
    const headerSepPx = values.pkgGeometry ? values.headSep * CM_TO_PX : 0
    
    // Top boundary of the body text (excluding margin, header height, and header sep)
    const bodyTopPx = values.pkgGeometry 
        ? values.marginTop * CM_TO_PX + headerHeightPx + headerSepPx
        : 30
    
    // Calculate Body Bottom boundary (excluding margin)
    const bodyBottomMarginPx = values.pkgGeometry ? values.marginBottom * CM_TO_PX : 30
    const bodyBottomPx = PAGE_HEIGHT_PX - bodyBottomMarginPx

    // Calculate Margin Notes Position and Capped Width
    const bodyRightEdgePx = PAGE_WIDTH_PX - values.marginRight * CM_TO_PX;
    const marginNotesStartPx = bodyRightEdgePx + values.marginSep * CM_TO_PX;

    const marginNotesWidthCapPx = Math.min(
        values.marginWidth * CM_TO_PX, // Desired width
        PAGE_WIDTH_PX - marginNotesStartPx // Maximum available width to the right edge of the page
    );
    
    return {
        headerHeightPx,
        headerSepPx,
        bodyTopPx,
        bodyBottomPx,
        bodyBottomMarginPx,
        marginNotesStartPx,
        marginNotesWidthCapPx
    }
  }, [values, CM_TO_PX, PAGE_HEIGHT_PX])

  // Βοηθητική συνάρτηση για οπτικοποίηση (Χρησιμοποιούμε hexCode)
  const getColorPreview = (color: CustomColor) => {
    // Το color.hexCode είναι πάντα σε μορφή #RRGGBB
    return color.hexCode;
  }
  
  // Χειρισμός αλλαγής χρώματος από τον Color Picker
  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hexWithHash = e.target.value.toUpperCase();
    const hexWithoutHash = hexWithHash.replace('#', '');
    
    setNewColor(prev => ({ 
        ...prev, 
        values: hexWithoutHash, // Τιμή χωρίς # για το LaTeX
        hexCode: hexWithHash // Τιμή με # για το input type=color
    }));
  }
  
  // Χειρισμός αλλαγής τιμής από το Input (π.χ. FF0000)
  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '');
    let paddedValue = rawValue;
    
    // Εάν είναι λιγότεροι από 6 χαρακτήρες, συμπληρώνουμε με 0 από το τέλος (π.χ. F -> F00000)
    // Αυτό είναι απλοποίηση, αλλά βοηθάει στην οπτική αναπαράσταση
    while (paddedValue.length < 6) {
        paddedValue += '0';
    }
    
    // Κόβουμε στους 6 χαρακτήρες
    paddedValue = paddedValue.slice(0, 6);

    setNewColor(prev => ({
        ...prev,
        values: paddedValue, // Τιμή χωρίς # για το LaTeX
        hexCode: `#${paddedValue}` // Τιμή με # για το input type=color
    }));
  }


  return (
    <div style={{ display: 'flex', height: '100%', color: '#ccc', background: '#1e1e1e' }}>
      
      {/* LEFT COLUMN: Settings Form */}
      <div style={{ flex: 1, padding: '0 24px 24px 24px', overflowY: 'auto' }}>
        <Title level={4} style={{ color: '#fff', marginTop: 16, marginBottom: 24 }}>
          <FileTextOutlined /> Project Configuration
        </Title>

        <Form
          form={form}
          layout="vertical"
          initialValues={values}
          onValuesChange={handleValuesChange}
        >
          <Tabs defaultActiveKey="geometry" type="card">
            
            {/* TAB 1: GENERAL */}
            <TabPane tab={<span><FileTextOutlined /> General</span>} key="general">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="docClass" label="Document Class">
                    <Select>
                      <Option value="article">Article</Option>
                      <Option value="report">Report</Option>
                      <Option value="book">Book</Option>
                      <Option value="beamer">Beamer</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="fontSize" label="Font Size">
                    <Select>
                      <Option value={10}>10 pt</Option>
                      <Option value={11}>11 pt</Option>
                      <Option value={12}>12 pt</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="mainLang" label={<><GlobalOutlined /> Language</>}>
                    <Select
                      showSearch
                      placeholder="Select a language"
                      optionFilterProp="children"
                      filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={languageOptions.map(lang => ({
                          value: lang.value,
                          label: lang.label
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="paperSize" label="Paper Size">
                    <Select>
                      <Option value="a4paper">A4</Option>
                      <Option value="letterpaper">Letter</Option>
                      <Option value="b5paper">B5</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Divider style={{ borderColor: '#444' }} />
              <Form.Item name="title" label="Title"><Input /></Form.Item>
              <Form.Item name="author" label="Author"><Input /></Form.Item>
              <Form.Item name="date" label="Include Date" valuePropName="checked"><Switch /></Form.Item>
            </TabPane>

            {/* TAB 2: GEOMETRY */}
            <TabPane tab={<span><LayoutOutlined /> Geometry</span>} key="geometry">
              
              <Form.Item name="pkgGeometry" valuePropName="checked" style={{marginBottom: 0}}>
                <Checkbox style={{ color: '#fff' }}>Enable Geometry Package</Checkbox>
              </Form.Item>
              <Divider style={{ borderColor: '#444', margin: '12px 0' }} />

              {values.pkgGeometry && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {/* Section 1: Paper & Columns */}
                  <div style={{ background: '#252526', padding: 12, borderRadius: 6, border: '1px solid #303030' }}>
                    <div style={{ marginBottom: 12, fontWeight: 'bold', color: '#aaa', fontSize: 12, textTransform: 'uppercase' }}>Paper & Layout</div>
                    <Row gutter={16}>
                      <Col span={16}>
                        <Form.Item label="Columns" style={{ marginBottom: 8 }}>
                          <Form.Item name="columns" noStyle>
                            <Radio.Group size="small">
                              <Radio value="one">One column</Radio>
                              <Radio value="two">Two columns</Radio>
                            </Radio.Group>
                          </Form.Item>
                        </Form.Item>
                        {values.columns === 'two' && (
                          <Form.Item name="columnSep" label="Column Sep (cm)">
                            <InputNumber size="small" step={0.1} style={{ width: 100 }} />
                          </Form.Item>
                        )}
                      </Col>
                      <Col span={8}>
                        <Form.Item name="sidedness" label="Sidedness">
                          <Radio.Group size="small">
                            <Radio value="oneside">One side</Radio>
                            <Radio value="twoside">Two side</Radio>
                            <Radio value="asymmetric">Asymmetric</Radio>
                          </Radio.Group>
                        </Form.Item>
                       </Col>
                    </Row>
                  </div>

                  {/* Section 2: Margins */}
                  <div style={{ background: '#252526', padding: 12, borderRadius: 6, border: '1px solid #303030' }}>
                     <div style={{ marginBottom: 12, fontWeight: 'bold', color: '#aaa', fontSize: 12, textTransform: 'uppercase' }}>Margins (cm)</div>
                     <Row gutter={12}>
                       <Col span={6}><Form.Item name="marginTop" label="Top"><InputNumber size="small" step={0.1} min={0} style={{width:'100%'}} /></Form.Item></Col>
                       <Col span={6}><Form.Item name="marginBottom" label="Bottom"><InputNumber size="small" step={0.1} min={0} style={{width:'100%'}} /></Form.Item></Col>
                       <Col span={6}><Form.Item name="marginLeft" label="Left"><InputNumber size="small" step={0.1} min={0} style={{width:'100%'}} /></Form.Item></Col>
                       <Col span={6}><Form.Item name="marginRight" label="Right"><InputNumber size="small" step={0.1} min={0} style={{width:'100%'}} /></Form.Item></Col>
                     </Row>
                     
                     <Paragraph style={{ color: '#aaa', fontSize: 12, marginBottom: 8 }}>
                        Margin Notes (optional)
                     </Paragraph>
                     <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 8 }}>
                        <Form.Item name="marginNotes" valuePropName="checked" noStyle>
                          <Checkbox>Enable Notes</Checkbox>
                        </Form.Item>
                        {values.marginNotes && (
                          <>
                             <Form.Item name="includeMp" valuePropName="checked" noStyle><Checkbox>Include to body</Checkbox></Form.Item>
                             <Form.Item name="marginSep" label="Sep" noStyle><InputNumber size="small" step={0.1} min={0} style={{width: 60, marginLeft: 10}} placeholder="Sep" /></Form.Item>
                             <Form.Item name="marginWidth" label="Width" noStyle><InputNumber size="small" step={0.1} min={0} style={{width: 60, marginLeft: 5}} placeholder="Width" /></Form.Item>
                          </>
                        )}
                     </div>
                  </div>

                  {/* Section 3: Header / Footer / Offsets */}
                  <div style={{ background: '#252526', padding: 12, borderRadius: 6, border: '1px solid #303030' }}>
                    <div style={{ marginBottom: 12, fontWeight: 'bold', color: '#aaa', fontSize: 12, textTransform: 'uppercase' }}>Header - Footer (cm)</div>
                    <Row gutter={12}>
                      <Col span={8}><Form.Item name="headHeight" label="Head Height"><InputNumber size="small" step={0.1} min={0} style={{width:'100%'}} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="headSep" label="Head Sep"><InputNumber size="small" step={0.1} min={0} style={{width:'100%'}} /></Form.Item></Col>
                      <Col span={8} style={{ display: 'flex', alignItems: 'center' }}>
                         <Form.Item name="includeHead" valuePropName="checked" noStyle><Checkbox>Include Header</Checkbox></Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={12}>
                      <Col span={8}><Form.Item name="footSkip" label="Foot Skip"><InputNumber size="small" step={0.1} min={0} style={{width:'100%'}} /></Form.Item></Col>
                      <Col span={8}><Form.Item name="bindingOffset" label="Binding Offset"><InputNumber size="small" step={0.1} style={{width:'100%'}} /></Form.Item></Col>
                      <Col span={8} style={{ display: 'flex', alignItems: 'center' }}>
                         <Form.Item name="includeFoot" valuePropName="checked" noStyle><Checkbox>Include Footer</Checkbox></Form.Item>
                      </Col>
                    </Row>
                  </div>
                </div>
              )}
            </TabPane>

            {/* TAB 3: PACKAGES */}
            <TabPane tab={<span><AppstoreAddOutlined /> Packages</span>} key="packages">
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <Card size="small" title="Mathematics" bordered={false} style={{ background: '#252526', color: '#fff' }}>
                    <Form.Item name="pkgAmsmath" valuePropName="checked" noStyle><Checkbox>AMS Math Suite</Checkbox></Form.Item>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card size="small" title="Graphics" bordered={false} style={{ background: '#252526', color: '#fff' }}>
                    <Form.Item name="pkgGraphicx" valuePropName="checked" noStyle><Checkbox>Graphicx</Checkbox></Form.Item>
                  </Card>
                </Col>
                <Col span={12}>
                   <Card size="small" title="Diagrams" bordered={false} style={{ background: '#252526', color: '#fff' }}>
                    <Form.Item name="pkgTikz" valuePropName="checked" noStyle><Checkbox>TikZ</Checkbox></Form.Item>
                    <Form.Item name="pkgPgfplots" valuePropName="checked" noStyle><Checkbox style={{marginTop:8}}>Pgfplots</Checkbox></Form.Item>
                  </Card>
                </Col>
                <Col span={12}>
                   <Card size="small" title="Formatting" bordered={false} style={{ background: '#252526', color: '#fff' }}>
                    <Form.Item name="pkgBooktabs" valuePropName="checked" noStyle><Checkbox>Booktabs (Tables)</Checkbox></Form.Item>
                    <Form.Item name="pkgFancyhdr" valuePropName="checked" noStyle><Checkbox style={{marginTop:8}}>Fancyhdr (Headers/Footers)</Checkbox></Form.Item>
                    <Form.Item name="pkgHyperref" valuePropName="checked" noStyle><Checkbox style={{marginTop:8}}>Hyperref (Links)</Checkbox></Form.Item>
                  </Card>
                </Col>
                
                {/* Νέα ενότητα: XColor Custom Definitions */}
                <Col span={24}>
                    <Card size="small" title="XColor Custom Definitions (HTML/HEX)" bordered={false} style={{ background: '#252526', color: '#fff' }}>
                        <Form.Item name="pkgXcolor" valuePropName="checked" noStyle>
                            <Checkbox style={{ marginBottom: 16 }}>Enable Xcolor Package</Checkbox>
                        </Form.Item>
                        {values.pkgXcolor && (
                            <div>
                                <Paragraph style={{ color: '#aaa', fontSize: 12, marginBottom: 8, marginTop: 0 }}>
                                    Defined Colors:
                                </Paragraph>
                                {/* Display existing custom colors */}
                                {customColors.map(color => (
                                    <div key={color.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '6px 10px', border: '1px solid #444', borderRadius: 4, background: '#333' }}>
                                        <Typography.Text style={{ color: '#fff', display: 'flex', alignItems: 'center' }}>
                                            <span style={{ 
                                                display: 'inline-block', 
                                                width: 14, 
                                                height: 14, 
                                                borderRadius: '50%', 
                                                marginRight: 10, 
                                                border: '1px solid #fff',
                                                background: getColorPreview(color) // Οπτικοποίηση
                                            }}></span>
                                            {color.name} <Tag color="blue"  style={{ marginLeft: 8 }}>{color.model}</Tag>
                                            <Tag color="default" style={{ marginLeft: 8 }}>{color.values}</Tag>
                                        </Typography.Text>
                                        <Button 
                                            icon={<CloseOutlined />}
                                            danger 
                                            size="small" 
                                            type="text"
                                            onClick={() => setCustomColors(customColors.filter(c => c.id !== color.id))}
                                        />
                                    </div>
                                ))}

                                <Divider style={{ borderColor: '#444' }} plain>Add New Color</Divider>

                                {/* Form to add a new color - NOW INTERACTIVE */}
                                <Row gutter={12} align="bottom">
                                    <Col span={8}>
                                        <Input 
                                            size="small" 
                                            placeholder="Name (e.g., myred)"
                                            value={newColor.name}
                                            onChange={(e) => setNewColor(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                    </Col>
                                    <Col span={10}>
                                        <Input.Group compact size="small">
                                            {/* Input type="color" for interactive selection */}
                                            <input
                                                type="color"
                                                style={{ width: 30, height: 30, padding: 0, border: '1px solid #444', background: 'transparent' }}
                                                value={newColor.hexCode}
                                                onChange={handleColorInputChange}
                                            />
                                            {/* Input type="text" for HEX value display/manual entry */}
                                            <Input 
                                                style={{ width: 'calc(100% - 30px)', fontFamily: 'monospace' }}
                                                value={newColor.values}
                                                maxLength={6}
                                                prefix={<BgColorsOutlined style={{ color: newColor.hexCode }} />}
                                                onChange={handleHexInputChange}
                                                placeholder="HEX (e.g., FF0000)"
                                            />
                                        </Input.Group>
                                        <Paragraph style={{ color: '#777', fontSize: 10, marginTop: 4, marginBottom: 0 }}>
                                            Model: HTML (HEX)
                                        </Paragraph>
                                    </Col>
                                    <Col span={6}>
                                        <Button 
                                            type="dashed" 
                                            block 
                                            size="small"
                                            onClick={handleAddColor}
                                            disabled={!newColor.name || newColor.values.length !== 6}
                                        >
                                            Add
                                        </Button>
                                    </Col>
                                </Row>
                            </div>
                        )}
                    </Card>
                </Col>
              </Row>
            </TabPane>

          </Tabs>
        </Form>
      </div>

      {/* RIGHT COLUMN: Preview */}
      <div style={{ width: 400, borderLeft: '1px solid #303030', background: '#252526', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 12, borderBottom: '1px solid #303030', display: 'flex', justifyContent: 'center' }}>
          <Radio.Group value={previewTab} onChange={e => setPreviewTab(e.target.value)} buttonStyle="solid">
            <Radio.Button value="code"><CodeOutlined /> Code</Radio.Button>
            <Radio.Button value="visual"><FormatPainterOutlined /> Visual</Radio.Button>
          </Radio.Group>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {previewTab === 'code' ? (
             <TextArea 
              value={generatedCode} 
              style={{ flex: 1, resize: 'none', background: '#1e1e1e', color: '#9cdcfe', fontFamily: 'monospace', border: 'none', padding: 16 }} 
              readOnly 
            />
          ) : (
            <div style={{ flex: 1, background: '#1e1e1e', display: 'flex', justifyContent: 'center', padding: 20, overflow: 'auto' }}>
              <div style={{
                width: PAGE_WIDTH_PX,
                height: PAGE_HEIGHT_PX,
                background: 'white',
                position: 'relative',
                boxShadow: '0 0 20px rgba(0,0,0,0.5)',
                transition: 'all 0.3s ease',
                overflow: 'hidden' // Αποφυγή οπτικής υπερχείλισης
              }}>
                {/* --- Visualization Header Area --- */}
                {values.pkgGeometry && geometryStyles.headerHeightPx > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        // Left/Right position uses the margins
                        left: values.marginLeft * CM_TO_PX,
                        right: values.marginRight * CM_TO_PX,
                        height: geometryStyles.headerHeightPx,
                        background: 'rgba(255, 165, 0, 0.1)',
                        borderBottom: `1px solid orange`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: 'orange', opacity: 0.8,
                        padding: '0 5px',
                        overflow: 'hidden' // Αποφυγή υπερχείλισης κειμένου στο header
                    }}>
                        HEADER ({values.headHeight}cm)
                    </div>
                )}
                
                {/* Visualization Header Sep Area (Space between header and body) */}
                {values.pkgGeometry && geometryStyles.headerSepPx > 0 && (
                    <div style={{
                        position: 'absolute',
                        top: geometryStyles.headerHeightPx,
                        left: values.marginLeft * CM_TO_PX,
                        right: values.marginRight * CM_TO_PX,
                        height: geometryStyles.headerSepPx,
                        background: 'rgba(255, 165, 0, 0.05)',
                        borderBottom: '1px dashed #303030'
                    }}>
                    </div>
                )}


                {/* Margins Box Visualization (BODY TEXT AREA) */}
                <div style={{
                  position: 'absolute',
                  // Start Top position takes into account the margin, header height, and header separation.
                  top: geometryStyles.bodyTopPx, 
                  bottom: PAGE_HEIGHT_PX - geometryStyles.bodyBottomPx,
                  left: values.pkgGeometry ? values.marginLeft * CM_TO_PX : 30,
                  right: values.pkgGeometry ? values.marginRight * CM_TO_PX : 30,
                  border: '1px dashed #1890ff',
                  background: 'rgba(24, 144, 255, 0.05)',
                  display: 'flex',
                  gap: values.columns === 'two' ? values.columnSep * CM_TO_PX : 0
                }}>
                  {/* Columns Visualization */}
                  {values.columns === 'two' ? (
                    <>
                      <div style={{ flex: 1, border: '1px dotted #ccc', background: 'rgba(0,0,0,0.02)' }}></div>
                      <div style={{ flex: 1, border: '1px dotted #ccc', background: 'rgba(0,0,0,0.02)' }}></div>
                    </>
                  ) : (
                    <div style={{ flex: 1, border: '1px dotted #ccc', background: 'rgba(0,0,0,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        Body Text Area
                    </div>
                  )}
                </div>
                
                {/* --- Margin Notes Visualization (Εκτός Body Box για σωστή θέση) --- */}
                {values.pkgGeometry && values.marginNotes && (
                    <div style={{ 
                        position: 'absolute', 
                        top: geometryStyles.bodyTopPx, 
                        bottom: PAGE_HEIGHT_PX - geometryStyles.bodyBottomPx,
                        // Η αριστερή θέση ξεκινάει από το δεξί άκρο του κειμένου + διαχωριστικό
                        left: geometryStyles.marginNotesStartPx,
                        // Το πλάτος περιορίζεται για να μην ξεπερνά το δεξί άκρο της σελίδας
                        width: geometryStyles.marginNotesWidthCapPx, 
                        border: '1px solid green',
                        background: 'rgba(0,255,0,0.1)',
                        fontSize: 8, color: 'green', display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl',
                        overflow: 'hidden' // Αποφυγή υπερχείλισης κειμένου στις σημειώσεις
                    }}>
                      Margin Notes Area
                    </div>
                  )}

                {/* --- Visualization Footer Area --- */}
                {values.pkgGeometry && values.footSkip > 0 && (
                    <div style={{
                        position: 'absolute',
                        // Το top είναι η αρχή του κάτω περιθωρίου (bottom margin)
                        top: geometryStyles.bodyBottomPx,
                        bottom: 0, 
                        left: values.marginLeft * CM_TO_PX,
                        right: values.marginRight * CM_TO_PX,
                        height: geometryStyles.bodyBottomMarginPx, // Το ύψος της περιοχής του footer είναι ίσο με το κάτω περιθώριο
                        paddingTop: values.footSkip * CM_TO_PX, // Προσομοιώνει το κενό (footskip)
                        background: 'rgba(100, 100, 255, 0.1)',
                        borderTop: `1px solid blue`,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
                        fontSize: 10, color: 'blue', opacity: 0.8,
                        overflow: 'hidden' // Αποφυγή υπερχείλισης κειμένου στο footer
                    }}>
                        <div style={{ border: '1px solid blue', padding: 2, background: 'rgba(255,255,255,0.7)'}}>
                            FOOTER (Skip: {values.footSkip}cm)
                        </div>
                    </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: 16, borderTop: '1px solid #303030' }}>
          <Button type="primary" block size="large" icon={<CheckOutlined />} onClick={() => onInsert(generatedCode)}>
            Create Document
          </Button>
        </div>
      </div>
    </div>
  )
}

export default PreambleWizardView