import React from 'react'
import { Modal, Pressable, StyleSheet } from 'react-native'
import { YStack, XStack, Text, ScrollView } from 'tamagui'
import type { InlineNode } from '../../services/parser/types'

interface FootnoteSheetProps {
  visible: boolean
  footnoteId: string | null
  content: InlineNode[] | null
  onClose: () => void
  textColor: string
  backgroundColor: string
  fontSize: number
}

/** Рекурсивный рендер InlineNode[] в текстовые элементы */
function renderFootnoteInlines(
  nodes: InlineNode[],
  fontSize: number,
  textColor: string,
  key?: string,
): React.ReactNode {
  return nodes.map((node, index) => {
    const nodeKey = `${key ?? 'root'}-${index}`

    switch (node.type) {
      case 'text':
        return (
          <Text key={nodeKey} fontSize={fontSize} color={textColor}>
            {node.text}
          </Text>
        )

      case 'bold':
        return (
          <Text key={nodeKey} fontWeight="bold" fontSize={fontSize} color={textColor}>
            {renderFootnoteInlines(node.children, fontSize, textColor, nodeKey)}
          </Text>
        )

      case 'italic':
        return (
          <Text key={nodeKey} fontStyle="italic" fontSize={fontSize} color={textColor}>
            {renderFootnoteInlines(node.children, fontSize, textColor, nodeKey)}
          </Text>
        )

      case 'link':
        return (
          <Text key={nodeKey} textDecorationLine="underline" fontSize={fontSize} color={textColor}>
            {renderFootnoteInlines(node.children, fontSize, textColor, nodeKey)}
          </Text>
        )

      case 'sup':
        return (
          <Text key={nodeKey} fontSize={fontSize * 0.7} color={textColor}>
            {renderFootnoteInlines(node.children, fontSize * 0.7, textColor, nodeKey)}
          </Text>
        )

      case 'sub':
        return (
          <Text key={nodeKey} fontSize={fontSize * 0.7} color={textColor}>
            {renderFootnoteInlines(node.children, fontSize * 0.7, textColor, nodeKey)}
          </Text>
        )

      case 'footnote-ref':
        return (
          <Text key={nodeKey} fontSize={fontSize} color={textColor}>
            {node.label}
          </Text>
        )

      default:
        return null
    }
  })
}

/** Модальный листок для отображения текста сноски */
export function FootnoteSheet({
  visible,
  footnoteId,
  content,
  onClose,
  textColor,
  backgroundColor,
  fontSize,
}: FootnoteSheetProps): React.ReactElement | null {
  if (content === null) return null

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Затемнённый фон — нажатие закрывает лист */}
      <Pressable style={styles.overlay} onPress={onClose} />

      {/* Сам листок */}
      <YStack
        backgroundColor={backgroundColor}
        borderTopLeftRadius="$4"
        borderTopRightRadius="$4"
        paddingHorizontal="$4"
        paddingTop="$3"
        paddingBottom="$6"
        maxHeight="50%"
        position="absolute"
        bottom={0}
        left={0}
        right={0}
      >
        {/* Шапка с идентификатором сноски и кнопкой закрытия */}
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
          <Text fontSize={fontSize * 0.85} color={textColor} opacity={0.6}>
            {footnoteId ?? ''}
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text fontSize={fontSize + 2} color={textColor} opacity={0.7}>
              ✕
            </Text>
          </Pressable>
        </XStack>

        {/* Контент сноски */}
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text fontSize={fontSize} color={textColor} lineHeight={fontSize * 1.5}>
            {renderFootnoteInlines(content, fontSize, textColor)}
          </Text>
        </ScrollView>
      </YStack>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
})
