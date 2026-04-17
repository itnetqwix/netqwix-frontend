import React, { useEffect, useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  Card,
  CardImg,
  CardTitle,
} from "reactstrap";
import { getFriends } from "../../common/common.api";
import { Utils } from "../../../utils/utils";
import { X } from "react-feather";
import "./common.scss";
import { useMediaQuery } from "usehooks-ts";
import { toast } from "react-toastify";

const FriendsPopup = ({ props }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const width500 = useMediaQuery("(max-width:500px)");
  const toggle = () => setIsOpen((prev) => !prev);

  const handleSelectFriend = (id) => {
    // Only allow one friend to be selected at a time
    const isSame = props.selectedFriends.includes(id);
    const nextIds = isSame ? [] : [id];
    props.setSelectedFriends(nextIds);
    if (props.setSelectedFriendProfiles) {
      const nextProfiles = isSame ? [] : friends.filter((f) => f._id === id);
      props.setSelectedFriendProfiles(nextProfiles);
    }
  };

  const fetchFriends = async () => {
    setLoading(true);
    try {
      const response = await getFriends();
      console.log("[FriendsPopup] getFriends response", response);
      setFriends(response?.friends || []);
    } catch (error) {
      console.error("Error fetching friends list:", error);
      const apiError =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Unable to load friends list.";
      toast.error(apiError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  return (
    <div className="d-flex flex-direction-column my-2">
      <button
        className="m-auto px-3 py-2 rounded border-0"
        style={{
          background: "#ffffff",
          color: "#1f2937",
          border: "1px solid #d1d5db",
          fontWeight: 600,
          minHeight: "44px",
          minWidth: "140px",
        }}
        onClick={toggle}
      >
        {props.buttonLabel}
      </button>

      <Modal
        isOpen={isOpen}
        toggle={toggle}
        centered
        fade
        className="friends-modal"
        contentClassName="d-flex flex-column"
        style={{ backgroundColor: "rgba(17, 24, 39, 0.45)" }}
      >
        <div
          className="d-flex justify-content-end p-2"
          style={{ position: "absolute", top: 0, right: 0, zIndex: 10 }}
        >
          <button
            type="button"
            className="close"
            onClick={toggle}
            style={{
              background: "transparent",
              border: "none",
              color: "#374151",
              cursor: "pointer",
            }}
          >
            <X />
          </button>
        </div>

        <ModalBody
          className="d-flex flex-column p-0"
          style={{
            flexGrow: 1,
            backgroundColor: "#ffffff",
            borderRadius: "12px 12px 0 0",
            width: "min(92vw, 860px)",
            margin: "0 auto",
            overflow: "hidden",
          }}
        >
          <div
            className="d-flex align-items-center justify-content-center"
            style={{
              minHeight: "64px",
              borderBottom: "1px solid #e5e7eb",
              padding: "0 16px",
              backgroundColor: "#ffffff",
            }}
          >
            <h5
              style={{
                margin: 0,
                fontSize: width500 ? "16px" : "18px",
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Select a Friend
            </h5>
          </div>
          {loading ? (
            <div
              className="d-flex justify-content-center align-items-center flex-grow-1"
              style={{ minHeight: "260px", backgroundColor: "#ffffff" }}
            >
              <div className="spinner-border text-primary" role="status">
                <span className="sr-only">Loading...</span>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                flexWrap: "wrap",
                gap: "15px",
                padding: width500 ? "12px" : "16px",
                maxHeight: width500 ? "58vh" : "60vh",
                overflowY: "auto",
                backgroundColor: "#ffffff",
              }}
            >
              {friends.map((friend) => {
                const profileImage =
                  friend.profile_picture
                    ? Utils.getImageUrlOfS3(friend.profile_picture)
                    : "/assets/images/demoUser.png";
                return (
                  <Card
                    key={friend._id}
                    style={{
                      width: width500 ? "135px" : "150px",
                      border: props.selectedFriends.includes(friend._id) ? "2px solid #22c55e" : "1px solid #d1d5db",
                      cursor: "pointer",
                      height: "fit-content",
                      borderRadius: "12px",
                      overflow: "hidden",
                      boxShadow: "0 2px 10px rgba(0,0,0,0.07)",
                    }}
                    onClick={() => handleSelectFriend(friend._id)}
                    className="rounded"
                  >
                    <CardImg
                      top
                      style={{ minHeight: 145, maxHeight: 145, objectFit: "cover" }}
                      src={profileImage}
                      alt="profile"
                    />
                    <CardTitle className="text-center m-0 p-2 bg-secondary text-white">
                      {friend.fullname}
                    </CardTitle>
                    <input
                      className="position-absolute"
                      type="radio"  // Changed from checkbox to radio
                      name="friendSelection"  // Added name attribute for radio group
                      checked={props.selectedFriends.includes(friend._id)}
                      onChange={() => handleSelectFriend(friend._id)}
                      style={{ marginTop: "5px", right: "5px" }}
                    />
                  </Card>
                );
              })}
            </div>
          )}
        </ModalBody>
        <ModalFooter
          style={{
            backgroundColor: "#ffffff",
            borderTop: "1px solid #e5e7eb",
            width: "min(92vw, 860px)",
            margin: "0 auto",
            borderRadius: "0 0 12px 12px",
            display: "flex",
            justifyContent: "center",
            padding: width500 ? "10px 12px" : "12px 16px",
          }}
        >
            <Button
              className="m-auto"
              style={{
                backgroundColor: "#22c55e",
                borderColor: "#22c55e",
                minHeight: "44px",
                fontWeight: 600,
                minWidth: width500 ? "140px" : "180px",
              }}
              onClick={toggle}
            >
              Select
            </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default FriendsPopup;