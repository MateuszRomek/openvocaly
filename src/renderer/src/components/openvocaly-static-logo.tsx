import { cn } from '@renderer/lib/utils'
import openvocalyLogoTransparentDark192 from '@renderer/assets/logos/transparent/openvocaly-logo-transparent-dark-192.png'
import openvocalyLogoTransparentDark512 from '@renderer/assets/logos/transparent/openvocaly-logo-transparent-dark-512.png'
import openvocalyLogoTransparentLight192 from '@renderer/assets/logos/transparent/openvocaly-logo-transparent-light-192.png'
import openvocalyLogoTransparentLight512 from '@renderer/assets/logos/transparent/openvocaly-logo-transparent-light-512.png'

export type OpenVocalyStaticLogoProps = {
  size?: number
  className?: string
}

export function OpenVocalyStaticLogo({
  size = 28,
  className
}: OpenVocalyStaticLogoProps): React.JSX.Element {
  return (
    <div className={cn('shrink-0', className)} style={{ width: size, height: size }}>
      <img
        src={openvocalyLogoTransparentDark192}
        srcSet={`${openvocalyLogoTransparentDark512} 2x`}
        alt="OpenVocaly logo"
        className="h-full w-full object-contain dark:hidden"
        draggable={false}
      />
      <img
        src={openvocalyLogoTransparentLight192}
        srcSet={`${openvocalyLogoTransparentLight512} 2x`}
        alt="OpenVocaly logo"
        className="hidden h-full w-full object-contain dark:block"
        draggable={false}
      />
    </div>
  )
}
