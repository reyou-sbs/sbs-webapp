import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>sbs-webapp</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="/static/style.css" />
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
      </head>
      <body class="bg-gray-50 text-gray-800">
        <div class="max-w-6xl mx-auto p-6">
          {children}
        </div>
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
        <script src="/static/app.js"></script>
        <script src="/static/admin.js"></script>
      </body>
    </html>
  )
})
