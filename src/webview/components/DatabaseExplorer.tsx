import React from "react"

const DatabaseExplorer: React.FC = () => {
  return (
    <div className='p-6'>
      <h2 className='text-2xl font-bold text-green-400 mb-4'>Database Explorer</h2>
      <div className='card p-6'>
        <p className='text-gray-300 mb-4'>Database connection and schema explorer will be implemented in Phase 4.</p>
        <div className='space-y-3'>
          <div className='text-sm text-gray-400'>
            <strong>Planned Features:</strong>
          </div>
          <ul className='text-gray-300 space-y-1 text-sm'>
            <li>• Database connection management</li>
            <li>• Schema tree view</li>
            <li>• Table/view listings</li>
            <li>• Metadata display</li>
            <li>• Connection testing</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default DatabaseExplorer