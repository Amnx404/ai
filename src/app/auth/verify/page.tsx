export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-green-600">
            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
        <p className="mt-2 text-sm text-gray-600">
          A sign-in link has been sent to your email address. Click the link to
          continue.
        </p>
        <p className="mt-4 text-xs text-gray-400">
          Didn&apos;t receive it? Check your spam folder or try again.
        </p>
      </div>
    </div>
  );
}
