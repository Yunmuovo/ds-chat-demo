plugins {
    id("com.android.application")
}

android {
    namespace = "com.yunmuovo.dschat"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.yunmuovo.dschat"
        minSdk = 24
        targetSdk = 34
        versionCode = 9
        versionName = "1.8"
    }

    // 固定签名：密钥由 CI 首次构建时生成并提交，保证后续版本可以覆盖安装
    // 注意路径在 android/ 下（根工程），不在 app 模块里
    val keystoreFile = rootProject.file("keystore.jks")

    signingConfigs {
        create("stable") {
            check(keystoreFile.exists()) { "缺少签名密钥：android/keystore.jks" }
            storeFile = keystoreFile
            storePassword = "dschat2024"
            keyAlias = "dschat"
            keyPassword = "dschat2024"
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("stable")
        }
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("stable")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
