import { useRef } from "react";
import { FileFormates } from "./constants";

const UploadFile = ({
  onChange,
  name,
  key,
  values,
  isError,
  accept,
  multiple = false,
  label,
}) => {
  const fileInputRef = useRef();
  const handleFileSelect = () => {
    fileInputRef?.current?.click();
  };

  // Default to images only; callers can pass accept="video/*" or any MIME string
  const acceptValue = accept ?? FileFormates.image;

  return (
    <div
      className={`d-flex align-items-center border ${
        isError ? "border-danger" : "border-dark"
      } rounded p-10 mt-2`}
      onClick={handleFileSelect}
      style={{ cursor: "pointer", gap: "8px" }}
    >
      <input
        key={key}
        type="file"
        ref={fileInputRef}
        name={name}
        value={values}
        style={{ display: "none" }}
        onChange={onChange}
        accept={acceptValue}
        multiple={multiple}
      />
      <h2 className="fa fa-cloud-upload" aria-hidden="true" />
      {label && <span style={{ fontSize: "14px" }}>{label}</span>}
    </div>
  );
};

export default UploadFile;
