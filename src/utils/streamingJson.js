function findStringFieldValueStart(source, fieldName) {
  let objectDepth = 0;
  let arrayDepth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (char === "{") {
      objectDepth += 1;
      continue;
    }

    if (char === "}") {
      objectDepth = Math.max(0, objectDepth - 1);
      continue;
    }

    if (char === "[") {
      arrayDepth += 1;
      continue;
    }

    if (char === "]") {
      arrayDepth = Math.max(0, arrayDepth - 1);
      continue;
    }

    if (char !== "\"") continue;

    const literal = readJsonStringLiteral(source, index);
    if (!literal.complete) return -1;

    if (objectDepth === 1 && arrayDepth === 0 && literal.text === fieldName) {
      let cursor = literal.endIndex + 1;
      while (/\s/.test(source[cursor] || "")) cursor += 1;
      if (source[cursor] === ":") {
        cursor += 1;
        while (/\s/.test(source[cursor] || "")) cursor += 1;
        if (source[cursor] === "\"") {
          return cursor + 1;
        }
      }
    }

    index = literal.endIndex;
  }

  return -1;
}

function readJsonStringLiteral(source, startIndex) {
  let text = "";

  for (let index = startIndex + 1; index < source.length; index += 1) {
    const char = source[index];

    if (char === "\"") {
      return { complete: true, text, endIndex: index };
    }

    if (char !== "\\") {
      text += char;
      continue;
    }

    if (index + 1 >= source.length) {
      return { complete: false, text, endIndex: index };
    }

    const escaped = source[index + 1];
    index += 1;

    if (escaped === "\"") text += "\"";
    else if (escaped === "\\") text += "\\";
    else if (escaped === "/") text += "/";
    else if (escaped === "b") text += "\b";
    else if (escaped === "f") text += "\f";
    else if (escaped === "n") text += "\n";
    else if (escaped === "r") text += "\r";
    else if (escaped === "t") text += "\t";
    else if (escaped === "u") {
      const hex = source.slice(index + 1, index + 5);
      if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) {
        return { complete: false, text, endIndex: index };
      }
      text += String.fromCharCode(Number.parseInt(hex, 16));
      index += 4;
    } else {
      text += escaped;
    }
  }

  return { complete: false, text, endIndex: source.length - 1 };
}

function readJsonStringPrefix(source, startIndex) {
  let text = "";

  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];

    if (char === "\"") {
      return { complete: true, text };
    }

    if (char !== "\\") {
      text += char;
      continue;
    }

    if (index + 1 >= source.length) {
      return { complete: false, text };
    }

    const escaped = source[index + 1];
    index += 1;

    if (escaped === "\"") text += "\"";
    else if (escaped === "\\") text += "\\";
    else if (escaped === "/") text += "/";
    else if (escaped === "b") text += "\b";
    else if (escaped === "f") text += "\f";
    else if (escaped === "n") text += "\n";
    else if (escaped === "r") text += "\r";
    else if (escaped === "t") text += "\t";
    else if (escaped === "u") {
      const hex = source.slice(index + 1, index + 5);
      if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) {
        return { complete: false, text };
      }
      text += String.fromCharCode(Number.parseInt(hex, 16));
      index += 4;
    } else {
      text += escaped;
    }
  }

  return { complete: false, text };
}

function createJsonStringFieldExtractor(fieldName, onDelta) {
  let buffer = "";
  let emittedLength = 0;
  let complete = false;

  return {
    push(delta) {
      if (complete) return;

      buffer += String(delta || "");
      const startIndex = findStringFieldValueStart(buffer, fieldName);
      if (startIndex === -1) return;

      const result = readJsonStringPrefix(buffer, startIndex);
      if (result.text.length > emittedLength) {
        const nextDelta = result.text.slice(emittedLength);
        emittedLength = result.text.length;
        if (nextDelta && typeof onDelta === "function") {
          onDelta(nextDelta);
        }
      }

      complete = result.complete;
    },

    isComplete() {
      return complete;
    }
  };
}

module.exports = {
  createJsonStringFieldExtractor,
  findStringFieldValueStart,
  readJsonStringPrefix
};
