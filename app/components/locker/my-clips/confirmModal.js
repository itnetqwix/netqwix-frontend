import React from "react";
import { Button, Modal, ModalBody, ModalHeader, Spinner } from "reactstrap";

const ConfirmModal = ({
  isModelOpen,
  selectedId,
  deleteFunc,
  closeModal,
  title = "Delete this clip?",
  description,
  message,
  clipTitle,
  isDeleting,
}) => {
  const safeTitle =
    clipTitle && String(clipTitle).trim().length > 0
      ? clipTitle.trim()
      : "this clip";

  const bodyText =
    description ||
    message ||
    `You are about to permanently delete "${safeTitle}". This cannot be undone and the video will be removed from your uploads.`;

  return (
    <>
      <Modal
        isOpen={isModelOpen}
        centered
        toggle={isDeleting ? undefined : closeModal}
        backdrop={isDeleting ? "static" : true}
        keyboard={!isDeleting}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ModalHeader
          toggle={isDeleting ? undefined : closeModal}
          style={{
            textAlign: "left",
            borderBottom: "1px solid #e0e0e0",
            padding: "20px 24px",
          }}
        >
          <h5
            style={{
              fontSize: "18px",
              fontWeight: 600,
              margin: 0,
              color: "#333",
            }}
          >
            {title}
          </h5>
        </ModalHeader>
        <ModalBody style={{ padding: "24px" }}>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: "15px",
              lineHeight: 1.5,
              color: "#444",
            }}
          >
            {bodyText}
          </p>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <Button
              color="secondary"
              outline
              onClick={closeModal}
              disabled={isDeleting}
              style={{
                minWidth: "108px",
                padding: "10px 18px",
                fontSize: "14px",
                fontWeight: 500,
                borderRadius: "6px",
              }}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onClick={() => deleteFunc(selectedId)}
              disabled={isDeleting}
              style={{
                minWidth: "132px",
                padding: "10px 18px",
                fontSize: "14px",
                fontWeight: 600,
                borderRadius: "6px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {isDeleting ? (
                <Spinner size="sm" color="light" />
              ) : (
                "Delete permanently"
              )}
            </Button>
          </div>
        </ModalBody>
      </Modal>
    </>
  );
};

export default ConfirmModal;
