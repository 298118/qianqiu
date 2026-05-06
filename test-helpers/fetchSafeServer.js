const FETCH_BLOCKED_PORTS = new Set([
  1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53,
  69, 77, 79, 87, 95, 101, 102, 103, 104, 109, 110, 111, 113, 115, 117,
  119, 123, 135, 137, 139, 143, 161, 179, 389, 427, 465, 512, 513, 514,
  515, 526, 530, 531, 532, 540, 548, 554, 556, 563, 587, 601, 636, 989,
  990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000,
  6566, 6665, 6666, 6667, 6668, 6669, 6697, 10080
]);

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

function createFetchSafeServer(app) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const server = app.listen(0);
    const address = server.address();
    const port = address && typeof address === "object" ? address.port : null;

    if (port && !FETCH_BLOCKED_PORTS.has(port)) {
      return {
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => closeServer(server)
      };
    }

    server.close();
  }

  throw new Error("Could not allocate a fetch-safe test port");
}

module.exports = {
  createFetchSafeServer
};
