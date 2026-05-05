import React from 'react'
import MyCommunity from '../../app/components/myCommunity';

function MyCommunitySideBar(props) {
  return (
    <div className={`notification-tab dynemic-sidebar custom-scroll ${props.tab === "my_community" ? "active" : ""}`} id="my_community">
     
      <div className="theme-title ml-3 mb-2">
        <div className="media">
          <div>
            <h2>My Community</h2>
            {/* <h4>Shared Media</h4> */}
          </div>
        </div>
      </div>
     
      <div style={{ maxHeight: '85vh', overflowY: 'auto'  }} className='transaction-table' >
      <MyCommunity />
      </div>
    </div>
  )
}

export default MyCommunitySideBar
