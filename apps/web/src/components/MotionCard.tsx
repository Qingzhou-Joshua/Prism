/**
 * MotionCard — 带入场动画的卡片容器
 * 用于 item-card-grid 中的每个卡片，提供 stagger 入场 + hover 微交互
 */
import { motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import type { ReactNode } from 'react'
import React from 'react'

interface MotionCardProps {
  children: ReactNode
  index?: number
  className?: string
  style?: React.CSSProperties
  onClick?: React.MouseEventHandler<HTMLDivElement>
  'data-testid'?: string
}

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1]

/** 卡片入场动画变体 */
const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 14,
    scale: 0.98,
  },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.045,
      duration: 0.32,
      ease: EASE_OUT_EXPO,
    },
  }),
}

export function MotionCard({ children, index = 0, className, style, onClick }: MotionCardProps) {
  return (
    <motion.div
      className={`item-card${className ? ` ${className}` : ''}`}
      style={style}
      onClick={onClick}
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      whileHover={{ y: -2, transition: { duration: 0.18, ease: 'easeOut' } }}
      layout
    >
      {children}
    </motion.div>
  )
}

/** 容器变体 — 让子元素 stagger 进入 */
export const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.045,
    },
  },
}

/** 用于包裹 item-card-grid 的容器 */
export function MotionGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={`item-card-grid${className ? ` ${className}` : ''}`}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {children}
    </motion.div>
  )
}

/** 淡入容器 — 用于页面级内容区块 */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: EASE_OUT_EXPO }}
    >
      {children}
    </motion.div>
  )
}
