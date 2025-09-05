import { useRef } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import { QueueItem } from './QueueItem'

const ItemTypes = {
  QUEUE_ITEM: 'queueItem'
}

interface DragItem {
  id: string
  index: number
}

interface DraggableQueueItemProps {
  download: any
  index: number
  position?: number
  isActive?: boolean
  onCancel?: (id: string) => void
  onPause?: (id: string) => void
  onResume?: (id: string) => void
  onMoveUp?: (id: string) => void
  onMoveDown?: (id: string) => void
  onSetPriority?: (id: string, priority: 'high' | 'normal' | 'low') => void
  onMoveItem: (dragIndex: number, hoverIndex: number) => void
  showDragHandle?: boolean
  showPosition?: boolean
}

export function DraggableQueueItem({
  download,
  index,
  position,
  isActive = false,
  onCancel,
  onPause,
  onResume,
  onMoveUp,
  onMoveDown,
  onSetPriority,
  onMoveItem,
  showDragHandle = false,
  showPosition = false
}: DraggableQueueItemProps) {
  const ref = useRef<HTMLDivElement>(null)

  const [{ handlerId }, drop] = useDrop<DragItem, void, { handlerId: any }>({
    accept: ItemTypes.QUEUE_ITEM,
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      }
    },
    hover(item: DragItem, monitor) {
      if (!ref.current) {
        return
      }
      const dragIndex = item.index
      const hoverIndex = index

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return
      }

      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect()

      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2

      // Determine mouse position
      const clientOffset = monitor.getClientOffset()

      // Get pixels to the top
      const hoverClientY = (clientOffset?.y ?? 0) - hoverBoundingRect.top

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%

      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return
      }

      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return
      }

      // Time to actually perform the action
      onMoveItem(dragIndex, hoverIndex)

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex
    },
  })

  const [{ isDragging }, drag, dragPreview] = useDrag({
    type: ItemTypes.QUEUE_ITEM,
    item: () => {
      return { id: download.id, index }
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  })

  const opacity = isDragging ? 0.4 : 1

  // Only allow dragging for queued items
  if (showDragHandle && download.status === 'queued') {
    dragPreview(drop(ref))
  } else {
    drop(ref)
  }

  return (
    <div 
      ref={ref} 
      style={{ opacity }}
      data-handler-id={handlerId}
      className={`transition-opacity ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      <QueueItem
        download={download}
        position={position}
        isActive={isActive}
        onCancel={onCancel}
        onPause={onPause}
        onResume={onResume}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onSetPriority={onSetPriority}
        showDragHandle={showDragHandle}
        showPosition={showPosition}
      />
    </div>
  )
}
