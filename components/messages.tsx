'use client'

import { MemoizedReactMarkdown } from '@/components/markdown'
import { cn } from '@/lib/utils'
import type { UseChatHelpers } from '@ai-sdk/react'
import { ArrowPathIcon, ClipboardIcon } from '@heroicons/react/24/outline'
import { ArrowDownIcon } from '@heroicons/react/24/solid'
import type { UIMessage } from 'ai'
import { AnimatePresence, motion } from 'framer-motion'
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type React from 'react'
import rehypeExternalLinks from 'rehype-external-links'
import remarkGfm from 'remark-gfm'
import { type AvatarData, AvatarGroup } from './avatar-group'
import { ChevronDownIcon, ChevronUpIcon } from './icons'
import { markdownComponents } from './markdown-components'
import ShinyText from './shiny-text'

interface ReasoningPart {
  type: 'reasoning'
  reasoning: string
  details: Array<{ type: 'text'; text: string }>
}

interface ReasoningMessagePartProps {
  part: ReasoningPart
  isReasoning: boolean
}

export function ReasoningMessagePart({
  part,
  isReasoning,
}: ReasoningMessagePartProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [reasoningSeconds, setReasoningSeconds] = useState<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const variants = {
    collapsed: {
      height: 0,
      opacity: 0,
      marginTop: 0,
      marginBottom: 0,
    },
    expanded: {
      height: 'auto',
      opacity: 1,
      marginTop: '1rem',
      marginBottom: 0,
    },
  }

  useEffect(() => {
    // Start timing when reasoning begins
    if (isReasoning && !startTimeRef.current) {
      startTimeRef.current = Date.now()

      // Update the timer every 100ms for a smooth display
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000
          setReasoningSeconds(elapsedSeconds)
        }
      }, 100)
    }

    // Stop timing when reasoning ends
    if (!isReasoning && startTimeRef.current) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      // Set final time
      const finalTime = (Date.now() - startTimeRef.current) / 1000
      setReasoningSeconds(finalTime)
      startTimeRef.current = null
    }

    // Clean up timer when component unmounts
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isReasoning])

  useEffect(() => {
    if (!isReasoning) {
      setIsExpanded(false)
    }
  }, [isReasoning])

  // Format the reasoning time display
  const getReasoningTimeText = () => {
    if (reasoningSeconds === null) {
      return 'Reasoned for a few seconds'
    }

    if (reasoningSeconds < 1) {
      return 'Reasoned for less than a second'
    }
    if (reasoningSeconds === 1) {
      return 'Reasoned for 1 second'
    }
    return `Reasoned for ${reasoningSeconds.toFixed(1)} seconds`
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => {
          setIsExpanded(!isExpanded)
        }}
        className="flex cursor-pointer flex-row items-center gap-2"
      >
        {isReasoning ? (
          <ShinyText
            text="Reasoning"
            disabled={false}
            speed={2}
            className="font-light text-sm"
          />
        ) : (
          <p className="font-light text-[#54545494] text-sm transition-colors hover:text-black/80 dark:text-[#b5b5b5a4] dark:hover:text-white/80">
            {getReasoningTimeText()}
          </p>
        )}

        {isExpanded ? <ChevronDownIcon /> : <ChevronUpIcon />}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="reasoning"
            className="flex flex-col gap-4 border-l pl-3 text-[#54545494] text-sm dark:border-neutral-800 dark:text-[#b5b5b5a4]"
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={variants}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {part.details.map((detail, detailIndex) =>
              detail.type === 'text' ? (
                <MemoizedReactMarkdown
                  key={`${detailIndex}-${detail.text}`}
                  components={markdownComponents}
                >
                  {detail.text}
                </MemoizedReactMarkdown>
              ) : (
                '<redacted>'
              )
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

interface TextMessagePartProps {
  text: string
}

type Annotation = {
  type: string
  title: string
  results: Array<AnnotationResult>
}

type AnnotationResult = {
  title: string
  url: string
  content: string
  icon_url: string
}

function AnnotationDisplay({
  annotation,
  messageId,
  index,
}: {
  annotation: AnnotationResult[]
  messageId: string
  index: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [activeCitation, setActiveCitation] = useState<number | null>(null)
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 })
  const popupRef = useRef<HTMLDivElement>(null)

  const variants = {
    collapsed: {
      height: 0,
      opacity: 0,
      marginTop: 0,
      marginBottom: 0,
      filter: 'blur(5px)',
    },
    expanded: {
      height: 'auto',
      opacity: 1,
      marginTop: '0.5rem',
      marginBottom: '0.5rem',
      filter: 'blur(0px)',
    },
  }

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        setActiveCitation(null)
      }
    }

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveCitation(null)
      }
    }

    if (activeCitation !== null) {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleEscKey)
    }

    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscKey)
    }
  }, [activeCitation])

  const handleCitationClick = (e: React.MouseEvent, citationIndex: number) => {
    e.preventDefault()
    e.stopPropagation()

    const rect = e.currentTarget.getBoundingClientRect()
    const x = rect.left
    const y = rect.bottom + window.scrollY + 5

    setPopupPosition({ x, y })
    setActiveCitation(citationIndex)
  }

  const websiteIconList = annotation.map((item) => {
    return {
      src: item.icon_url,
      name: item.title,
    } as AvatarData
  })

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setIsExpanded(!isExpanded)
          }
        }}
        key={`annotation-${messageId}-${index}`}
        className="flex w-fit cursor-pointer flex-row items-center justify-between gap-1 rounded-full border border-neutral-200 bg-neutral-50 py-1 pr-1 pl-2 text-xs transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800/50 dark:hover:bg-neutral-700/70"
        onClick={() => setIsExpanded(!isExpanded)}
        tabIndex={0}
      >
        <p className={'font-semibold'}>{annotation.length}</p> Webpages
        <AvatarGroup
          avatars={websiteIconList}
          overlap={'sm'}
          size={'xs'}
          max={5}
        />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="annotation-list"
            className="mt-2 flex flex-col gap-2 text-neutral-700 text-xs dark:text-neutral-300"
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={variants}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <ul className="list-disc space-y-1 pl-5">
              {annotation.map((item, i) => (
                <li key={`${messageId}-${index}-${i + 1}`}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-blue-600 hover:underline dark:text-blue-400"
                    onClick={(e) => handleCitationClick(e, i)}
                  >
                    {item.title || item.url}
                  </a>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {activeCitation !== null && (
        <div
          ref={popupRef}
          className="fixed z-10 max-w-md rounded-[20px] border border-neutral-200 bg-white px-4 py-3 shadow-lg shadow-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:shadow-none"
          style={{
            top: `${popupPosition.y}px`,
            left: `${popupPosition.x}px`,
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setActiveCitation(null)
            }
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h4 className="mb-1 font-medium">
            {annotation[activeCitation].title || `Source ${activeCitation + 1}`}
          </h4>
          <p className="mb-2 break-all text-neutral-500 text-xs dark:text-neutral-400">
            <a
              href={annotation[activeCitation].url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {annotation[activeCitation].url}
            </a>
          </p>
          <p className="text-sm">
            {annotation[activeCitation].content.substring(0, 200)}...
          </p>
          <button
            type="button"
            className="mt-2 text-blue-600 text-xs hover:underline dark:text-blue-400"
            onClick={() => setActiveCitation(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}

// Memoize TextMessagePart to prevent unnecessary re-renders
const MemoizedTextMessagePart = memo(
  ({ text }: TextMessagePartProps) => (
    <MemoizedReactMarkdown
      rehypePlugins={[[rehypeExternalLinks, { target: '_blank' }]]}
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
    >
      {text}
    </MemoizedReactMarkdown>
  ),
  (prevProps, nextProps) => prevProps.text === nextProps.text
)
MemoizedTextMessagePart.displayName = 'MemoizedTextMessagePart'

export function TextMessagePart({ text }: TextMessagePartProps) {
  // const containsLaTeX = /\\\[([\s\S]*?)\\]|\\\(([\s\S]*?)\\\)/.test(text || '')
  // const processedData = preprocessLaTeX(text || '')

  // if (containsLaTeX) {
  //   return (
  //     <MemoizedReactMarkdown
  //       rehypePlugins={[
  //         [rehypeExternalLinks, { target: '_blank' }],
  //         [rehypeKatex],
  //       ]}
  //       remarkPlugins={[remarkGfm, remarkMath]}
  //       components={markdownComponents}
  //     >
  //       {processedData}
  //     </MemoizedReactMarkdown>
  //   )
  // }

  return <MemoizedTextMessagePart text={text} />
}

interface MessagesProps {
  messages: Array<UIMessage>
  status: UseChatHelpers['status']
  fetchStatus?: string
  reload?: () => void
  setMessages?: (messages: Array<UIMessage>) => void
}

interface MessageProps {
  message: UIMessage
  status: UseChatHelpers['status']
  fetchStatus?: string
  isLastAssistantMessage: boolean
  onRegenerate: () => void
}

const Message = memo(
  ({
    message,
    status,
    fetchStatus,
    isLastAssistantMessage,
    onRegenerate,
  }: MessageProps) => {
    // 展平所有 annotation.results 以便根据引用索引查找
    const allResults =
      message.annotations?.flatMap((annotation) => {
        const typedAnnotation = annotation as Annotation | null
        return typedAnnotation?.results || []
      }) || []

    // 替换引用标识为 Markdown 图标链接
    const replaceCitations = (text: string) => {
      if (allResults.length === 0) {
        return text
      }
      return text.replace(/\[(\d+)\]/g, (match, numStr) => {
        const num = Number.parseInt(numStr, 10)
        // 检查索引是否在有效范围内
        if (num >= 1 && num <= allResults.length) {
          const result = allResults[num - 1] // 索引从 0 开始，因此减 1
          return `[ ![citation ${num}](${result.icon_url}) ](${result.url})`
        }
        return match // 如果索引无效，保留原始文本
      })
    }

    // Add a message ID-based key for message parts to improve rendering
    return (
      <div
        className={cn(
          'flex w-full flex-col gap-4 first-of-type:mt-16 last-of-type:mb-12'
        )}
      >
        <div
          className={cn('flex flex-col gap-2', {
            'mb-3 ml-auto w-fit rounded-lg bg-neutral-100 px-2 py-1 dark:bg-neutral-700/50':
              message.role === 'user',
            '': message.role === 'assistant',
          })}
        >
          {message.annotations?.map((annotation, index) => {
            const annotationList = annotation as Annotation
            return (
              <AnnotationDisplay
                key={`annotation-display-${message.id}-${index}`}
                annotation={annotationList.results}
                messageId={message.id}
                index={index}
              />
            )
          })}
          {message.role === 'assistant' &&
            message.content.length === 0 &&
            (fetchStatus === 'Success' || !fetchStatus) && (
              <ShinyText
                text="Generating..."
                disabled={false}
                speed={2}
                className="w-full font-light text-sm"
              />
            )}
          {message.parts.map((part, partIndex) => {
            // Generate a stable key based on content hash or other unique identifiers
            const partKey = `${message.id}-${partIndex}-${part.type}`

            if (part.type === 'text' && message.role !== 'user') {
              return (
                <TextMessagePart
                  key={partKey}
                  text={replaceCitations(part.text)}
                />
              )
            }
            if (part.type === 'text' && message.role === 'user') {
              return (
                <div
                  key={partKey}
                  className="flex flex-col gap-4 font-light text-sm"
                >
                  {part.text}
                </div>
              )
            }
            if (part.type === 'reasoning') {
              return (
                <ReasoningMessagePart
                  key={partKey}
                  // @ts-expect-error export ReasoningUIPart
                  part={part}
                  isReasoning={
                    status === 'streaming' &&
                    isLastAssistantMessage &&
                    partIndex === message.parts.length - 1
                  }
                />
              )
            }
          })}
        </div>
        {message.role === 'assistant' &&
          (!isLastAssistantMessage || status !== 'streaming') && (
            <div className="-mt-3 -ml-0.5 flex justify-start gap-2 transition-opacity">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(message.content)
                }}
                title="Copy to clipboard"
              >
                <ClipboardIcon className="size-4 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" />
              </button>
              <button
                disabled={status === 'streaming'}
                className={'disabled:cursor-not-allowed'}
                type="button"
                onClick={onRegenerate}
                title="Regenerate response"
              >
                <ArrowPathIcon className="size-4 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300" />
              </button>
            </div>
          )}
      </div>
    )
  },
  (prevProps, nextProps) => {
    // Enhanced memoization logic that includes content changes in individual parts
    if (
      prevProps.message.id !== nextProps.message.id ||
      prevProps.status !== nextProps.status ||
      prevProps.isLastAssistantMessage !== nextProps.isLastAssistantMessage ||
      prevProps.fetchStatus !== nextProps.fetchStatus
    ) {
      return false
    }

    // Check if content has changed
    if (prevProps.message.content !== nextProps.message.content) {
      return false
    }

    // Deep check of parts array if needed
    if (prevProps.message.parts.length !== nextProps.message.parts.length) {
      return false
    }

    // We've checked all critical props and found them equal, so don't re-render
    return true
  }
)

Message.displayName = 'Message'

export function Messages({
  messages,
  status,
  fetchStatus,
  reload,
  setMessages,
}: MessagesProps) {
  const bottomAnchorRef = useRef<HTMLDivElement>(null)

  const setMessagesAndReload = (messages: Array<UIMessage>) => {
    if (setMessages) {
      setMessages(messages)
    }
    if (reload) {
      reload()
    }
  }

  const lastAssistantIndex = useMemo(
    () => messages.findLastIndex((msg) => msg.role === 'assistant'),
    [messages]
  )

  return (
    <div className={cn('relative w-full flex-col items-center gap-4')}>
      {messages.map((message, messageIndex) => (
        <Message
          key={`message-${message.id}-${messageIndex}`}
          message={message}
          status={status}
          fetchStatus={fetchStatus}
          isLastAssistantMessage={
            message.role === 'assistant' && messageIndex === lastAssistantIndex
          }
          onRegenerate={() => {
            const newMessages = messages.slice(0, messageIndex + 1)
            setMessagesAndReload(newMessages)
          }}
        />
      ))}

      {fetchStatus &&
        fetchStatus !== 'Success' &&
        status !== 'submitted' &&
        status !== 'ready' && (
          <ShinyText
            text={fetchStatus}
            disabled={false}
            speed={2}
            className="-mt-4 mb-12 w-full font-light text-sm"
          />
        )}
      {status === 'submitted' && (
        <ShinyText
          text="Connecting..."
          disabled={false}
          speed={2}
          className="w-full font-light text-sm"
        />
      )}

      {/* Invisible element at bottom to serve as a scroll anchor */}
      <div ref={bottomAnchorRef} style={{ height: '1px', width: '100%' }} />
    </div>
  )
}
