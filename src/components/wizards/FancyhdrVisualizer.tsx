import React from 'react';
import { Box } from '@mantine/core';

interface FancyhdrVisualizerProps {
  documentType: 'oneside' | 'twoside';
  // Headers
  headerOddLeft: string;
  headerOddCenter: string;
  headerOddRight: string;
  headerEvenLeft: string;
  headerEvenCenter: string;
  headerEvenRight: string;
  // Footers
  footerOddLeft: string;
  footerOddCenter: string;
  footerOddRight: string;
  footerEvenLeft: string;
  footerEvenCenter: string;
  footerEvenRight: string;
  // Rules
  headRuleWidth: number;
  footRuleWidth: number;
  // Zoom
  zoomLevel?: number;
}

// Page dimensions in pixels (A4 at scale)
const BASE_PAGE_WIDTH = 400;
const BASE_PAGE_HEIGHT = 565;
const BASE_MARGIN = 50;

export const FancyhdrVisualizer: React.FC<FancyhdrVisualizerProps> = ({
  documentType,
  headerOddLeft, headerOddCenter, headerOddRight,
  headerEvenLeft, headerEvenCenter, headerEvenRight,
  footerOddLeft, footerOddCenter, footerOddRight,
  footerEvenLeft, footerEvenCenter, footerEvenRight,
  headRuleWidth, footRuleWidth,
  zoomLevel = 100
}) => {
  
  // Apply zoom to dimensions
  const scale = zoomLevel / 100;
  const PAGE_WIDTH = BASE_PAGE_WIDTH * scale;
  const PAGE_HEIGHT = BASE_PAGE_HEIGHT * scale;
  const MARGIN = BASE_MARGIN * scale;
  
  // Render a page showing header/footer layout
  const renderPage = (pageType: 'odd' | 'even', pageNumber: number) => {
    const isOdd = pageType === 'odd';
    
    const headerLeft = isOdd ? headerOddLeft : headerEvenLeft;
    const headerCenter = isOdd ? headerOddCenter : headerEvenCenter;
    const headerRight = isOdd ? headerOddRight : headerEvenRight;
    
    const footerLeft = isOdd ? footerOddLeft : footerEvenLeft;
    const footerCenter = isOdd ? footerOddCenter : footerEvenCenter;
    const footerRight = isOdd ? footerOddRight : footerEvenRight;
    
    // Process placeholders
    const process = (text: string) => {
      return text
        .replace(/\\thepage/g, String(pageNumber))
        .replace(/\\leftmark/g, 'CHAPTER')
        .replace(/\\rightmark/g, 'Section')
        .replace(/\\today/g, new Date().toLocaleDateString('en-GB'))
        .replace(/\\chaptername/g, 'Chapter')
        .replace(/\\@author/g, 'Author Name')
        .replace(/\\@title/g, 'Document Title')
        .replace(/\\thechapter/g, String(Math.floor(pageNumber / 2)))
        .replace(/\\thesection/g, `${Math.floor(pageNumber / 2)}.${pageNumber % 4}`)
        .replace(/\\\\/g, '');
    };
    
    // Scale-aware font sizes
    const baseFontSize = 12 * scale;
    const labelFontSize = 11 * scale;
    const headerHeight = 24 * scale;
    const ruleWidth = Math.max(1, headRuleWidth * scale);
    const footerRuleWidth = Math.max(1, footRuleWidth * scale);
    
    return (
      <div style={{
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        backgroundColor: 'white',
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        margin: `0 ${8 * scale}px`,
        borderRadius: 4 * scale,
        overflow: 'hidden'
      }}>
        
        {/* Page Number Label */}
        <div style={{
          position: 'absolute',
          top: 8 * scale,
          right: 12 * scale,
          fontSize: labelFontSize,
          color: '#999',
          fontWeight: 600
        }}>
          Page {pageNumber}
        </div>
        
        {/* Header Area */}
        <div style={{
          position: 'absolute',
          top: MARGIN - 30 * scale,
          left: MARGIN,
          right: MARGIN,
          height: headerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: headRuleWidth > 0 ? `${ruleWidth}px solid #333` : 'none',
          paddingBottom: 4 * scale,
          fontSize: baseFontSize,
          fontFamily: 'serif',
          color: '#333'
        }}>
          <div style={{ 
            flex: 1, 
            textAlign: 'left', 
            paddingRight: 8 * scale, 
            color: headerLeft ? '#000' : '#ccc',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {process(headerLeft) || 'Left'}
          </div>
          <div style={{ 
            flex: 1, 
            textAlign: 'center', 
            color: headerCenter ? '#000' : '#ccc',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {process(headerCenter) || 'Centre'}
          </div>
          <div style={{ 
            flex: 1, 
            textAlign: 'right', 
            paddingLeft: 8 * scale, 
            color: headerRight ? '#000' : '#ccc',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {process(headerRight) || 'Right'}
          </div>
        </div>
        
        {/* Body Area */}
        <div style={{
          position: 'absolute',
          top: MARGIN,
          left: MARGIN,
          right: MARGIN,
          bottom: MARGIN + 40 * scale,
          border: `${1 * scale}px dashed #ddd`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#aaa',
          fontSize: 14 * scale,
          fontStyle: 'italic'
        }}>
          Document Body
        </div>
        
        {/* Footer Area */}
        <div style={{
          position: 'absolute',
          bottom: MARGIN - 30 * scale,
          left: MARGIN,
          right: MARGIN,
          height: headerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: footRuleWidth > 0 ? `${footerRuleWidth}px solid #333` : 'none',
          paddingTop: 4 * scale,
          fontSize: baseFontSize,
          fontFamily: 'serif',
          color: '#333'
        }}>
          <div style={{ 
            flex: 1, 
            textAlign: 'left', 
            paddingRight: 8 * scale, 
            color: footerLeft ? '#000' : '#ccc',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {process(footerLeft) || 'Left'}
          </div>
          <div style={{ 
            flex: 1, 
            textAlign: 'center', 
            color: footerCenter ? '#000' : '#ccc',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {process(footerCenter) || 'Centre'}
          </div>
          <div style={{ 
            flex: 1, 
            textAlign: 'right', 
            paddingLeft: 8 * scale, 
            color: footerRight ? '#000' : '#ccc',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {process(footerRight) || 'Right'}
          </div>
        </div>
        
      </div>
    );
  };
  
  return (
    <Box h="100%" bg="dark.9" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 20 * scale }}>
      <div style={{ display: 'flex', gap: 16 * scale }}>
        {/* Show odd page for one-sided, both pages for two-sided */}
        {documentType === 'twoside' ? (
          <>
            {renderPage('even', 2)}
            {renderPage('odd', 3)}
          </>
        ) : (
          renderPage('odd', 1)
        )}
      </div>
    </Box>
  );
};
