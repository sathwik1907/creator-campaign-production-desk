import { extractText } from "unpdf";

/**
 * Creates an HTTP-friendly error.
 *
 * We attach a statusCode to the Error object so that
 * the API/controller can send the appropriate HTTP status.
 */
function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Cleans common noise produced during PDF/text extraction.
 *
 * This function:
 * - Removes null characters and BOM
 * - Normalizes line endings
 * - Converts non-breaking spaces
 * - Removes table-of-contents dot leaders
 * - Removes unnecessary spaces before line breaks
 * - Replaces multiple spaces with a single space
 * - Prevents excessive empty lines
 * - Removes whitespace at the beginning and end
 */
function cleanExtractedText(text) {
  return (
    text
      // Remove null characters and UTF-8 byte-order mark.
      .replace(/\u0000|\uFEFF/g, "")

      // Convert Windows (\r\n) and old Mac (\r) line endings to \n.
      .replace(/\r\n?/g, "\n")

      // Replace non-breaking spaces with normal spaces.
      .replace(/\u00A0/g, " ")

      // Remove table-of-contents dot leaders such as:
      // "Introduction....................1"
      // "Chapter 1 . . . . . . . . . . 5"
      .replace(/(?:\.[ \t]*){3,}/g, " ")

      // Remove spaces and tabs that appear immediately before a line break.
      .replace(/[ \t]+\n/g, "\n")

      // Replace multiple consecutive spaces/tabs with one space.
      .replace(/[ \t]{2,}/g, " ")

      // Allow a maximum of one empty line between paragraphs.
      .replace(/\n{3,}/g, "\n\n")

      // Remove whitespace from the beginning and end.
      .trim()
  );
}

/**
 * Extract text from a PDF buffer.
 *
 * @param {Buffer} fileBuffer - PDF file received from Multer
 * @returns {Promise<string>} - Cleaned text extracted from the PDF
 */
export async function extractPdfText(fileBuffer) {
  // Convert Node.js Buffer into Uint8Array,
  // which is the format expected by unpdf.
  const pdfData = new Uint8Array(fileBuffer);

  // Extract text from the PDF.
  //
  // IMPORTANT:
  // unpdf returns the extracted text using the "text" property.
  // It is NOT called "extractedText".
  const { text } = await extractText(pdfData, { mergePages: true });

  // Clean the extracted PDF text.
  const cleanedText = cleanExtractedText(text);

  // If the PDF contains no readable text, return an error.
  if (!cleanedText) {
    throw createError("No readable text was found in the uploaded file", 422);
  }

  return cleanedText;
}

/**
 * Extract and clean text from an uploaded PDF or TXT file.
 *
 * Supported file types:
 * - application/pdf
 * - text/plain
 *
 * @param {Buffer} fileBuffer - Uploaded file buffer
 * @param {string} mimeType - MIME type of uploaded file
 * @returns {Promise<string>} - Cleaned extracted text
 */
export async function extractTextFromFile(fileBuffer, mimeType) {
  // Make sure Multer provided a valid and non-empty file buffer.
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw createError("A valid, non-empty file buffer is required", 400);
  }

  // Make sure the MIME type was provided.
  if (typeof mimeType !== "string" || mimeType.trim() === "") {
    throw createError("File MIME type is required", 400);
  }

  let extractedText;

  // Determine how to process the uploaded file
  // based on its MIME type.
  switch (mimeType) {
    case "application/pdf":
      // PDF files need to be processed using unpdf.
      extractedText = await extractPdfText(fileBuffer);
      break;

    case "text/plain":
      // TXT files already contain readable text,
      // so we can directly convert the Buffer to UTF-8 text.
      extractedText = fileBuffer.toString("utf8");
      break;

    default:
      // Reject unsupported file types.
      throw createError(
        "Unsupported file type. Only PDF and TXT files are allowed",
        415,
      );
  }

  // Clean the extracted text.
  const cleanedText = cleanExtractedText(extractedText);

  // Make sure the file actually contained readable text.
  if (!cleanedText) {
    throw createError("No readable text was found in the uploaded file", 422);
  }

  // Return the final cleaned text.
  return cleanedText;
}
