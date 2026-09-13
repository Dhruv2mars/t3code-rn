Pod::Spec.new do |s|
  s.name         = "T3SidecarSpawner"
  s.version      = "0.1.0"
  s.summary      = "NSTask bridge for spawning the T3 host sidecar from React Native macOS"
  s.description  = "Spawns the sidecar node process and streams stdout/stderr/exit events into JS."
  s.homepage     = "https://github.com/Dhruv2mars/t3code-rn"
  s.license      = "MIT"
  s.authors      = { "T3 Code RN" => "dev@t3tools.local" }
  s.platforms    = { :osx => "14.0" }
  s.source       = { :path => __dir__ }
  s.source_files = "*.{h,mm}"
  s.dependency   "React-Core"
end
