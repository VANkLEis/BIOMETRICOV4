// ... (previous imports remain the same)

const VideoCall: React.FC = () => {
  // ... (previous state declarations remain the same)

  const [scanningActive, setScanningActive] = useState(false);
  const scanAnimationRef = useRef<number>();

  // Add scanning animation
  useEffect(() => {
    if (scanningActive && biometricType) {
      let progress = 0;
      const animate = () => {
        progress = (progress + 1) % 100;
        setScanProgress(progress);
        scanAnimationRef.current = requestAnimationFrame(animate);
      };
      scanAnimationRef.current = requestAnimationFrame(animate);

      return () => {
        if (scanAnimationRef.current) {
          cancelAnimationFrame(scanAnimationRef.current);
        }
      };
    }
  }, [scanningActive, biometricType]);

  const verifyBiometric = async (type: 'face' | 'fingerprint') => {
    if (role !== 'interviewer') return;
    
    setVerifyingBiometrics(true);
    setBiometricType(type);
    setScanningActive(true);
    
    try {
      // Simulate verification process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setBiometricStatus(prev => ({
        ...prev,
        [type]: true
      }));
    } finally {
      setScanningActive(false);
      setVerifyingBiometrics(false);
      setBiometricType(null);
      if (scanAnimationRef.current) {
        cancelAnimationFrame(scanAnimationRef.current);
      }
    }
  };

  // ... (rest of the component remains the same)
};

export default VideoCall;