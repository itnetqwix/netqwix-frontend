import React from 'react'
import ContactUs from '../../app/components/contactUs';

function ContactUSSideBar(props) {
  return (
    <div className={`notification-tab dynemic-sidebar custom-scroll ${props.tab === "contact_us" ? "active" : ""}`} id="contact_us">
      <div className="theme-title">
        <div className="media">
          <div>
            <h2>Contact Us</h2>
          </div>
        </div>
      </div>
      <div style={{ maxHeight: '85vh', overflowY: 'auto' }} className='transaction-table' >
      <ContactUs />
      </div>
    </div>
  )
}

export default ContactUSSideBar
