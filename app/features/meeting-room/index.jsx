import { useState, useEffect } from 'react';
import { useWindowDimensions } from '../../hook/useWindowDimensions';
import { meetingRoom } from '../bookings';

/**
 * MeetingRoomFeature
 * Owns orientation/rotation state and delegates rendering to the meetingRoom helper
 * from the bookings feature. Extracted from pages/dashboard/meeting-room.jsx.
 */
export default function MeetingRoomFeature() {
  const { height, width } = useWindowDimensions();
  const [isRotatedInitally, setIsRotatedInitally] = useState(false);

  useEffect(() => {
    if (height < width) setIsRotatedInitally(true);
  }, [height, width]);

  return (
    <div id="get-navbar-tabs" className="get-navbar-tabs" style={{ overflow: 'hidden', height: '100%' }}>
      {meetingRoom(height, width, isRotatedInitally)}
    </div>
  );
}
