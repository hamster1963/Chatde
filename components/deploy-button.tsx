import Link from 'next/link'
export const DeployButton = () => (
  <Link
    href={
      'https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fai-sdk-preview-reasoning%2Ftree%2Fmain&env=ANTHROPIC_API_KEY,FIREWORKS_API_KEY,GROQ_API_KEY&envDescription=Anthropic%20API%20key&envLink=https%3A%2F%2Fconsole.anthropic.com%2F'
    }
    target="_blank"
    rel="noopener noreferrer"
    className="ml-2 inline-flex items-center gap-2 rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-neutral-900 dark:bg-white dark:text-black dark:hover:bg-neutral-100"
  >
    <svg
      data-testid="geist-icon"
      height={14}
      strokeLinejoin="round"
      viewBox="0 0 16 16"
      width={14}
      style={{ color: 'currentcolor' }}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 1L16 15H0L8 1Z"
        fill="currentColor"
      />
    </svg>
    Deploy
  </Link>
)
