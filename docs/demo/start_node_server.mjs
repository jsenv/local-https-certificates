import { createServer } from "node:https"
import { requestCertificateForLocalhost } from "@jsenv/https-localhost"

const { serverCertificate, serverCertificatePrivateKey } = await requestCertificateForLocalhost({
  serverCertificateAltNames: ["localhost", "local.example.com"],
})

const server = createServer(
  {
    cert: serverCertificate,
    key: serverCertificatePrivateKey,
  },
  (request, response) => {
    const body = "Hello world"
    response.writeHead(200, {
      "content-type": "text/plain",
      "content-length": Buffer.byteLength(body),
    })
    response.write(body)
    response.end()
  },
)
server.listen(8080)
console.log(`Server listening at https://localhost:8080`)
