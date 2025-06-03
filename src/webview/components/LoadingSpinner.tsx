import React from "react"

export const LoadingSpinner: React.FC = () => {
  return (
    <div className='flex items-center justify-center h-full min-h-[200px]'>
      <div className='flex flex-col items-center space-y-4'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400'></div>
        <p className='text-gray-400 text-sm'>Loading...</p>
      </div>
    </div>
  )
}