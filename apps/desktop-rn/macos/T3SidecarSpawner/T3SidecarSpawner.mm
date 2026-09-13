#import "T3SidecarSpawner.h"

#import <React/RCTBridgeModule.h>

// Streams one spawned child process to JS. The app runs a single sidecar, so a
// single task slot keeps the bridge surface tiny; events posted before the JS
// listener subscribes are buffered and flushed on startObserving so the
// handshake line can never be dropped.
@implementation T3SidecarSpawner {
  NSTask *_task;
  NSMutableArray<NSDictionary *> *_pendingEvents;
  BOOL _hasListeners;
}

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if (self = [super init]) {
    _pendingEvents = [NSMutableArray array];
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[ @"sidecarStdout", @"sidecarStderr", @"sidecarExit" ];
}

- (void)startObserving
{
  _hasListeners = YES;
  NSArray<NSDictionary *> *pending = nil;
  @synchronized(_pendingEvents) {
    pending = [_pendingEvents copy];
    [_pendingEvents removeAllObjects];
  }
  for (NSDictionary *event in pending) {
    [super sendEventWithName:[event objectForKey:@"name"] body:[event objectForKey:@"body"]];
  }
}

- (void)stopObserving
{
  _hasListeners = NO;
}

- (void)dispatchEvent:(NSString *)name body:(id)body
{
  @synchronized(_pendingEvents) {
    if (!_hasListeners) {
      if ([_pendingEvents count] < 100) {
        [_pendingEvents addObject:@{ @"name" : name, @"body" : body }];
      }
      return;
    }
  }
  [super sendEventWithName:name body:body];
}

RCT_EXPORT_MODULE(T3SidecarSpawner)

RCT_EXPORT_METHOD(spawn
                  : (NSString *)nodeBin args
                  : (NSArray<NSString *> *)args env
                  : (NSDictionary<NSString *, NSString *> *)env resolver
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    @try {
      NSMutableDictionary<NSString *, NSString *> *childEnv =
          [NSMutableDictionary dictionaryWithDictionary:[NSProcessInfo processInfo].environment];
      for (NSString *key in env) {
        NSString *value = [env objectForKey:key];
        if (value == nil || value.length == 0) {
          [childEnv removeObjectForKey:key];
        } else {
          [childEnv setObject:value forKey:key];
        }
      }
      if ([childEnv objectForKey:@"T3CODE_HOME"].length == 0) {
        NSString *home = [NSTemporaryDirectory()
            stringByAppendingPathComponent:
                [NSString stringWithFormat:@"t3-rn-host-%@",
                                           [[NSUUID UUID] UUIDString]]];
        [[NSFileManager defaultManager] createDirectoryAtPath:home
                                  withIntermediateDirectories:YES
                                                   attributes:nil
                                                        error:nil];
        [childEnv setObject:home forKey:@"T3CODE_HOME"];
      }

      NSTask *task = [[NSTask alloc] init];
      task.executableURL = [NSURL fileURLWithPath:nodeBin];
      task.arguments = [args copy];
      task.environment = childEnv;
      NSPipe *stdoutPipe = [NSPipe pipe];
      NSPipe *stderrPipe = [NSPipe pipe];
      task.standardOutput = stdoutPipe;
      task.standardError = stderrPipe;

      [task setTerminationHandler:^(NSTask *finished) {
        [self dispatchEvent:@"sidecarExit"
                       body:@{ @"code" : @(finished.terminationStatus) }];
      }];

      __weak T3SidecarSpawner *weakSelf = self;
      NSFileHandle *stdoutHandle = stdoutPipe.fileHandleForReading;
      stdoutHandle.readabilityHandler = ^(NSFileHandle *handle) {
        NSData *data = handle.availableData;
        if (data.length == 0) {
          handle.readabilityHandler = nil;
          return;
        }
        NSString *chunk = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        if (chunk != nil && weakSelf != nil) {
          [weakSelf dispatchEvent:@"sidecarStdout" body:chunk];
        }
      };
      NSFileHandle *stderrHandle = stderrPipe.fileHandleForReading;
      stderrHandle.readabilityHandler = ^(NSFileHandle *handle) {
        NSData *data = handle.availableData;
        if (data.length == 0) {
          handle.readabilityHandler = nil;
          return;
        }
        NSString *chunk = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        if (chunk != nil && weakSelf != nil) {
          [weakSelf dispatchEvent:@"sidecarStderr" body:chunk];
        }
      };

      [task launch];
      _task = task;
      resolve(@{
        @"pid" : @(task.processIdentifier),
        @"t3Home" : [childEnv objectForKey:@"T3CODE_HOME"] ?: @"",
      });
    } @catch (NSException *exception) {
      reject(@"spawn_failed", exception.reason ?: @"sidecar spawn failed", nil);
    }
  });
}

RCT_EXPORT_METHOD(terminate
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)
{
  NSTask *task = _task;
  if (task != nil && task.isRunning) {
    [task terminate];
    resolve(@YES);
  } else {
    resolve(@NO);
  }
}

RCT_EXPORT_METHOD(launchEnvironment
                  : (RCTPromiseResolveBlock)resolve rejecter
                  : (RCTPromiseRejectBlock)reject)
{
  NSMutableDictionary<NSString *, NSString *> *out = [NSMutableDictionary dictionary];
  NSDictionary<NSString *, NSString *> *env = [NSProcessInfo processInfo].environment;
  for (NSString *key in env) {
    if ([key hasPrefix:@"T3CODE_RN_"]) {
      [out setObject:[env objectForKey:key] forKey:key];
    }
  }
  resolve(out);
}

@end
