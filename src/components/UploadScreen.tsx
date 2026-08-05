import { useCallback, useRef, useState } from "react";

interface Props {
  onFile: (blob: Blob, name: string) => void;
  loading: boolean;
  error: string | null;
}

export function UploadScreen({ onFile, loading, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [sampleError, setSampleError] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onFile(file, file.name.replace(/\.excalidraw$/i, ""));
    },
    [onFile],
  );

  const loadSample = useCallback(async () => {
    setSampleError(false);
    try {
      const res = await fetch("/sample.excalidraw");
      if (!res.ok) throw new Error();
      onFile(await res.blob(), "Sample sketch");
    } catch {
      setSampleError(true);
    }
  }, [onFile]);

  return (
    <main className="upload-screen">
      <header className="upload-brand">
        <span className="wordmark">Excalidraw Presenter</span>
      </header>

      <section
        className={`dropzone${dragging ? " is-dragging" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <h1>Turn a sketch into a stage.</h1>
        <p className="dropzone-sub">
          Drop an <code>.excalidraw</code> file here, choose the order and
          timing of each piece, then present it step by step.
        </p>

        {loading ? (
          <p className="dropzone-status" role="status">
            Reading your drawing…
          </p>
        ) : (
          <div className="dropzone-actions">
            <button
              className="btn btn-primary"
              onClick={() => inputRef.current?.click()}
            >
              Choose file
            </button>
            <button className="btn btn-ghost" onClick={loadSample}>
              Try the sample sketch
            </button>
          </div>
        )}

        {error && (
          <p className="dropzone-error" role="alert">
            {error}
          </p>
        )}
        {sampleError && (
          <p className="dropzone-error" role="alert">
            The sample couldn't be loaded. Choose a file instead.
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".excalidraw,application/json"
          hidden
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </section>

      <footer className="upload-hint">
        Tip: elements you group in Excalidraw are revealed together as one
        step.
      </footer>
    </main>
  );
}
